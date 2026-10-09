package com.dialbook.app

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.CallLog
import android.provider.MediaStore
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Background job: reads new entries from the phone's call history and logs calls with leads. */
class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val p = Prefs(applicationContext)
        if (!p.loggedIn) return@withContext Result.success()
        if (!applicationContext.has(Manifest.permission.READ_CALL_LOG)) return@withContext Result.success()
        try {
            CallSync.run(applicationContext)
            p.lastError = ""
            Result.success()
        } catch (e: Exception) {
            Log.w("Dialbook", "sync failed", e)
            p.lastError = e.message ?: "Sync failed"
            if (runAttemptCount < 3) Result.retry() else Result.success()
        }
    }

    companion object {
        fun runSoon(ctx: Context, delaySec: Long = 0) = scheduleNow(ctx, delaySec)
        fun schedulePeriodic(ctx: Context) = schedulePeriodicSync(ctx)
    }
}

object CallSync {
    private data class Row(val number: String, val type: Int, val date: Long, val duration: Long)

    /** uploads = false: only log calls (used right after a call ends); recordings are queued for the background job. */
    @Synchronized
    fun run(ctx: Context, uploads: Boolean = true) {
        val p = Prefs(ctx)
        // First run: only look back 2 hours so personal history is never uploaded in bulk.
        val since = if (p.lastSync == 0L) System.currentTimeMillis() - 2 * 3600_000L else p.lastSync
        val rows = mutableListOf<Row>()
        val proj = arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION)
        ctx.contentResolver.query(
            CallLog.Calls.CONTENT_URI, proj, "${CallLog.Calls.DATE} > ?", arrayOf(since.toString()),
            "${CallLog.Calls.DATE} ASC"
        )?.use { c ->
            while (c.moveToNext()) rows.add(Row(c.getString(0) ?: "", c.getInt(1), c.getLong(2), c.getLong(3)))
        }

        for (r in rows) {
            val direction = when (r.type) {
                CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                CallLog.Calls.INCOMING_TYPE -> "incoming"
                CallLog.Calls.MISSED_TYPE -> "missed"
                CallLog.Calls.REJECTED_TYPE -> "rejected"
                CallLog.Calls.BLOCKED_TYPE -> "blocked"
                else -> "other"
            }
            val digits = Fmt.digits(r.number)
            if (digits.length >= 6 && direction != "blocked" && !p.isPersonal(digits)) {
                val externalId = "${p.userId}:${r.date}:${digits.takeLast(10)}"
                val args = JSONObject()
                    .put("p_phone", r.number)
                    .put("p_direction", direction)
                    .put("p_started_at", Fmt.iso(r.date))
                    .put("p_duration", r.duration)
                    .put("p_external_id", externalId)
                val res = Api.rpc(ctx, "log_phone_call", args).trim()
                if (res.isEmpty() || res == "null") {
                    // Not a lead: nothing is saved. Ask the telecaller whether it was a new enquiry.
                    if (direction == "incoming" || direction == "outgoing" || direction == "missed") {
                        Notify.askUnknown(ctx, r.number, direction, r.date, r.duration, externalId)
                    }
                } else {
                    val o = JSONObject(res)
                    if (!o.optBoolean("duplicate")) {
                        val callId = o.getString("call_id")
                        p.callsLogged = p.callsLogged + 1
                        if (r.duration > 0 && p.recordingsEnabled) {
                            if (!uploads || !Recordings.tryUpload(ctx, callId, r.date, r.duration, digits)) {
                                Recordings.addPending(ctx, callId, r.date, r.duration, digits)
                            }
                        }
                        if (direction == "outgoing" || direction == "incoming") {
                            Notify.askOutcome(ctx, callId, o.optString("lead_name"), o.optString("lead_id"), r.duration, direction)
                        }
                    }
                }
            }
            p.lastSync = r.date
        }
        if (uploads) Recordings.retryPending(ctx)
        p.lastRun = System.currentTimeMillis()
    }
}

/**
 * Finds the call recording that the phone's own dialer saved (Samsung, Xiaomi, OnePlus, Oppo,
 * Realme, Vivo and others) and uploads it. Only files in call-recording folders, or whose name
 * contains the caller's number, are ever uploaded.
 */
object Recordings {
    private val FOLDERS = listOf(
        "Recordings/Call", "Recordings/Call Recordings", "Call", "Call Recordings", "CallRecordings",
        "MIUI/sound_recorder/call_rec", "Music/Recordings/Call Recordings", "Record/Call", "Record/PhoneRecord",
        "Recordings/PhoneRecord", "PhoneRecord", "Sounds/CallRecord", "Recorder/call", "Recordings/Sound records/Call"
    )

    private data class Candidate(val uri: Uri?, val file: File?, val name: String, val mime: String, val modified: Long)

    fun canRead(ctx: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && Environment.isExternalStorageManager()) return true
        return if (Build.VERSION.SDK_INT >= 33) ctx.has(Manifest.permission.READ_MEDIA_AUDIO)
        else ctx.has(Manifest.permission.READ_EXTERNAL_STORAGE)
    }

    private fun looksLikeCallRecording(path: String, name: String, digits: String): Boolean {
        val low = path.lowercase()
        val last = digits.takeLast(10)
        return low.contains("call") || low.contains("phonerecord") || (last.length >= 6 && Fmt.digits(name).contains(last))
    }

    private fun score(c: Candidate, callEnd: Long, digits: String): Long {
        var s = -Math.abs(c.modified - callEnd) / 1000
        if (digits.length >= 6 && Fmt.digits(c.name).contains(digits.takeLast(10))) s += 100_000
        return s
    }

    private fun find(ctx: Context, start: Long, durationSec: Long, digits: String): Candidate? {
        val end = start + durationSec * 1000
        val lo = start - 60_000
        val hi = end + 10 * 60_000
        val found = mutableListOf<Candidate>()
        val extra = Prefs(ctx).extraFolder.trim().trim('/').lowercase()

        // 1) Media index (works with the normal "Music and audio" permission)
        try {
            val uri = MediaStore.Files.getContentUri("external")
            val proj = arrayOf(MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.DATE_MODIFIED,
                MediaStore.MediaColumns.MIME_TYPE, MediaStore.MediaColumns.DATA, MediaStore.MediaColumns.SIZE)
            val sel = "${MediaStore.MediaColumns.MIME_TYPE} LIKE 'audio/%' AND ${MediaStore.MediaColumns.DATE_MODIFIED} BETWEEN ? AND ?"
            ctx.contentResolver.query(uri, proj, sel, arrayOf((lo / 1000).toString(), (hi / 1000).toString()), null)?.use { c ->
                while (c.moveToNext()) {
                    val id = c.getLong(0)
                    val name = c.getString(1) ?: ""
                    val path = c.getString(4) ?: ""
                    val size = c.getLong(5)
                    if (size < 2_000) continue
                    if (!looksLikeCallRecording(path, name, digits) && !(extra.isNotEmpty() && path.lowercase().contains(extra))) continue
                    found.add(Candidate(ContentUris.withAppendedId(uri, id), null, name, c.getString(3) ?: "audio/mpeg", c.getLong(2) * 1000))
                }
            }
        } catch (e: Exception) { Log.w("Dialbook", "media query failed", e) }

        // 2) Direct folder scan (needs "All files access", used when the media index misses a folder)
        if (found.isEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && Environment.isExternalStorageManager()) {
            val root = Environment.getExternalStorageDirectory()
            val folders = FOLDERS + listOfNotNull(Prefs(ctx).extraFolder.trim().trim('/').ifEmpty { null })
            for (f in folders) {
                val dir = File(root, f)
                dir.listFiles()?.forEach { file ->
                    val m = file.lastModified()
                    if (file.isFile && m in lo..hi && file.length() > 2_000) {
                        val ext = file.extension.lowercase()
                        if (ext in listOf("m4a", "mp3", "amr", "aac", "wav", "3gp", "ogg", "opus", "awb")) {
                            found.add(Candidate(null, file, file.name, mimeFor(ext), m))
                        }
                    }
                }
            }
        }
        return found.maxByOrNull { score(it, end, digits) }
    }

    private fun mimeFor(ext: String) = when (ext) {
        "mp3" -> "audio/mpeg"; "amr" -> "audio/amr"; "wav" -> "audio/wav"; "3gp" -> "audio/3gpp"
        "ogg", "opus" -> "audio/ogg"; "aac" -> "audio/aac"; "awb" -> "audio/amr-wb"; else -> "audio/mp4"
    }

    private fun extFor(c: Candidate): String {
        val e = c.name.substringAfterLast('.', "").lowercase()
        return if (e.isNotEmpty() && e.length <= 4) e else "m4a"
    }

    /** Returns true when a recording was uploaded (or there is nothing to wait for). */
    fun tryUpload(ctx: Context, callId: String, start: Long, durationSec: Long, digits: String): Boolean {
        if (!canRead(ctx)) return true
        val c = find(ctx, start, durationSec, digits) ?: return false
        val bytes = try {
            if (c.uri != null) ctx.contentResolver.openInputStream(c.uri)?.use { it.readBytes() } else c.file?.readBytes()
        } catch (e: Exception) { null } ?: return false
        if (bytes.size > 50 * 1024 * 1024) return true
        val p = Prefs(ctx)
        val path = "${p.userId}/$callId.${extFor(c)}"
        Api.upload(ctx, path, bytes, c.mime.ifEmpty { "audio/mp4" })
        Api.rpc(ctx, "attach_recording", JSONObject().put("p_call", callId).put("p_path", path))
        p.recordingsUploaded = p.recordingsUploaded + 1
        return true
    }

    fun addPending(ctx: Context, callId: String, start: Long, durationSec: Long, digits: String) {
        val p = Prefs(ctx)
        val arr = try { JSONArray(p.pendingRecs) } catch (e: Exception) { JSONArray() }
        arr.put(JSONObject().put("id", callId).put("start", start).put("dur", durationSec).put("d", digits).put("added", System.currentTimeMillis()))
        p.pendingRecs = arr.toString()
        scheduleRetry(ctx)
    }

    /** Some phones save the recording a little after the call ends; try again for up to 30 minutes. */
    fun retryPending(ctx: Context) {
        val p = Prefs(ctx)
        val arr = try { JSONArray(p.pendingRecs) } catch (e: Exception) { JSONArray() }
        val keep = JSONArray()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            if (System.currentTimeMillis() - o.optLong("added") > 30 * 60_000) continue
            val done = try { tryUpload(ctx, o.getString("id"), o.getLong("start"), o.getLong("dur"), o.optString("d")) } catch (e: Exception) { false }
            if (!done) keep.put(o)
        }
        p.pendingRecs = keep.toString()
    }

    fun pendingCount(ctx: Context): Int = try { JSONArray(Prefs(ctx).pendingRecs).length() } catch (e: Exception) { 0 }
}
