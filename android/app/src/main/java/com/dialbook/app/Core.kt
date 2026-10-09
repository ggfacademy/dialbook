package com.dialbook.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.TelephonyManager
import android.util.Base64
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/* ------------------------------------------------------------------ */
/* Application: notification channel + background sync schedule       */
/* ------------------------------------------------------------------ */
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL, "Call outcomes", NotificationManager.IMPORTANCE_HIGH)
            ch.description = "Asks you to log the outcome after a call with a lead"
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
        SyncWorker.schedulePeriodic(this)
    }

    companion object { const val CHANNEL = "calls" }
}

/* ------------------------------------------------------------------ */
/* Saved settings                                                      */
/* ------------------------------------------------------------------ */
class Prefs(ctx: Context) {
    private val p: SharedPreferences = ctx.getSharedPreferences("dialbook", Context.MODE_PRIVATE)

    var url: String get() = p.getString("url", "") ?: ""; set(v) = p.edit().putString("url", v).apply()
    var anonKey: String get() = p.getString("key", "") ?: ""; set(v) = p.edit().putString("key", v).apply()
    var access: String get() = p.getString("access", "") ?: ""; set(v) = p.edit().putString("access", v).apply()
    var refresh: String get() = p.getString("refresh", "") ?: ""; set(v) = p.edit().putString("refresh", v).apply()
    var expiresAt: Long get() = p.getLong("exp", 0); set(v) = p.edit().putLong("exp", v).apply()
    var userId: String get() = p.getString("uid", "") ?: ""; set(v) = p.edit().putString("uid", v).apply()
    var email: String get() = p.getString("email", "") ?: ""; set(v) = p.edit().putString("email", v).apply()
    var name: String get() = p.getString("name", "") ?: ""; set(v) = p.edit().putString("name", v).apply()
    var lastSync: Long get() = p.getLong("lastSync", 0); set(v) = p.edit().putLong("lastSync", v).apply()
    var lastRun: Long get() = p.getLong("lastRun", 0); set(v) = p.edit().putLong("lastRun", v).apply()
    var lastError: String get() = p.getString("lastError", "") ?: ""; set(v) = p.edit().putString("lastError", v).apply()
    var callsLogged: Int get() = p.getInt("logged", 0); set(v) = p.edit().putInt("logged", v).apply()
    var recordingsUploaded: Int get() = p.getInt("recs", 0); set(v) = p.edit().putInt("recs", v).apply()
    var recordingsEnabled: Boolean get() = p.getBoolean("recOn", true); set(v) = p.edit().putBoolean("recOn", v).apply()
    var extraFolder: String get() = p.getString("folder", "") ?: ""; set(v) = p.edit().putString("folder", v).apply()
    var dispositions: String get() = p.getString("dispos", "") ?: ""; set(v) = p.edit().putString("dispos", v).apply()
    var pendingRecs: String get() = p.getString("pendingRecs", "[]") ?: "[]"; set(v) = p.edit().putString("pendingRecs", v).apply()
    /** Numbers the telecaller marked "Personal call" (last 10 digits). Kept only on this phone. */
    var personal: Set<String> get() = p.getStringSet("personal", emptySet()) ?: emptySet(); set(v) = p.edit().putStringSet("personal", v).apply()
    fun isPersonal(digits: String) = personal.contains(digits.takeLast(10))
    fun addPersonal(digits: String) { personal = personal + digits.takeLast(10) }
    /** Calls with numbers not in the CRM, waiting for "Add as lead" / "Personal call". Kept only on this phone. */
    var unknownCalls: String get() = p.getString("unknownCalls", "[]") ?: "[]"; set(v) = p.edit().putString("unknownCalls", v).apply()
    fun addUnknown(o: JSONObject) {
        val arr = try { JSONArray(unknownCalls) } catch (e: Exception) { JSONArray() }
        for (i in 0 until arr.length()) if (arr.getJSONObject(i).optString("external_id") == o.optString("external_id")) return
        arr.put(o)
        val keep = JSONArray(); val from = maxOf(0, arr.length() - 30)
        for (i in from until arr.length()) keep.put(arr.get(i))
        unknownCalls = keep.toString()
    }
    /** Removes the given call, and every other waiting call with the same number. */
    fun removeUnknown(externalId: String, digits: String) {
        val arr = try { JSONArray(unknownCalls) } catch (e: Exception) { JSONArray() }
        val keep = JSONArray()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            if (o.optString("external_id") != externalId && Fmt.digits(o.optString("number")).takeLast(10) != digits.takeLast(10)) keep.put(o)
        }
        unknownCalls = keep.toString()
    }

    val connected get() = url.isNotEmpty() && anonKey.isNotEmpty()
    val loggedIn get() = connected && refresh.isNotEmpty() && userId.isNotEmpty()

    fun logout() {
        p.edit().remove("access").remove("refresh").remove("exp").remove("uid").remove("email").remove("name").apply()
    }

    /** Connection code from the web CRM: base64 of {"u": url, "k": anonKey}. */
    fun applyCode(code: String): Boolean {
        return try {
            val o = JSONObject(String(Base64.decode(code.trim(), Base64.DEFAULT)))
            val u = o.getString("u").trim().trimEnd('/')
            val k = o.getString("k").trim()
            if (!u.startsWith("https://") || k.length < 20) return false
            url = u; anonKey = k; true
        } catch (e: Exception) { false }
    }
}

/* ------------------------------------------------------------------ */
/* Supabase REST client (auth, database, storage)                      */
/* ------------------------------------------------------------------ */
class ApiError(message: String, val code: Int) : Exception(message)

object Api {
    private val http = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(180, TimeUnit.SECONDS)
        .build()
    private val JSON = "application/json; charset=utf-8".toMediaType()

    private fun errorText(body: String, code: Int): String = try {
        val o = JSONObject(body)
        o.optString("msg").ifEmpty { o.optString("message") }.ifEmpty { o.optString("error_description") }
            .ifEmpty { o.optString("error") }.ifEmpty { "Server error $code" }
    } catch (e: Exception) { "Server error $code" }

    private fun saveSession(ctx: Context, o: JSONObject) {
        val p = Prefs(ctx)
        p.access = o.getString("access_token")
        p.refresh = o.getString("refresh_token")
        p.expiresAt = System.currentTimeMillis() + o.optLong("expires_in", 3600) * 1000
        val u = o.optJSONObject("user")
        if (u != null) { p.userId = u.getString("id"); p.email = u.optString("email") }
    }

    fun login(ctx: Context, email: String, password: String) {
        val p = Prefs(ctx)
        val body = JSONObject().put("email", email).put("password", password).toString()
        val req = Request.Builder().url("${p.url}/auth/v1/token?grant_type=password")
            .header("apikey", p.anonKey).post(body.toRequestBody(JSON)).build()
        http.newCall(req).execute().use { r ->
            val t = r.body?.string() ?: ""
            if (!r.isSuccessful) throw ApiError(if (r.code == 400) "Wrong email or password." else errorText(t, r.code), r.code)
            saveSession(ctx, JSONObject(t))
        }
    }

    @Synchronized
    private fun refreshToken(ctx: Context) {
        val p = Prefs(ctx)
        val body = JSONObject().put("refresh_token", p.refresh).toString()
        val req = Request.Builder().url("${p.url}/auth/v1/token?grant_type=refresh_token")
            .header("apikey", p.anonKey).post(body.toRequestBody(JSON)).build()
        http.newCall(req).execute().use { r ->
            val t = r.body?.string() ?: ""
            if (!r.isSuccessful) {
                if (r.code == 400 || r.code == 401) p.logout()
                throw ApiError("Please sign in again.", r.code)
            }
            saveSession(ctx, JSONObject(t))
        }
    }

    private fun token(ctx: Context): String {
        val p = Prefs(ctx)
        if (p.access.isEmpty() || System.currentTimeMillis() > p.expiresAt - 60_000) refreshToken(ctx)
        return Prefs(ctx).access
    }

    private fun send(ctx: Context, method: String, path: String, body: String?, extra: Map<String, String> = emptyMap(), retry: Boolean = true): String {
        val p = Prefs(ctx)
        val b = Request.Builder().url(p.url + path)
            .header("apikey", p.anonKey)
            .header("Authorization", "Bearer " + token(ctx))
        extra.forEach { (k, v) -> b.header(k, v) }
        when (method) {
            "GET" -> b.get()
            else -> b.method(method, (body ?: "{}").toRequestBody(JSON))
        }
        http.newCall(b.build()).execute().use { r ->
            val t = r.body?.string() ?: ""
            if (r.code == 401 && retry) { refreshToken(ctx); return send(ctx, method, path, body, extra, false) }
            if (!r.isSuccessful) throw ApiError(errorText(t, r.code), r.code)
            return t
        }
    }

    fun get(ctx: Context, path: String): String = send(ctx, "GET", path, null)
    fun rpc(ctx: Context, fn: String, args: JSONObject): String = send(ctx, "POST", "/rest/v1/rpc/$fn", args.toString())

    fun upload(ctx: Context, objectPath: String, bytes: ByteArray, contentType: String) {
        val p = Prefs(ctx)
        val req = Request.Builder().url("${p.url}/storage/v1/object/recordings/$objectPath")
            .header("apikey", p.anonKey)
            .header("Authorization", "Bearer " + token(ctx))
            .header("x-upsert", "true")
            .post(bytes.toRequestBody(contentType.toMediaType())).build()
        http.newCall(req).execute().use { r ->
            if (!r.isSuccessful) throw ApiError(errorText(r.body?.string() ?: "", r.code), r.code)
        }
    }

    /** Loads the signed-in person's profile; returns null when not approved yet. */
    fun profile(ctx: Context): JSONObject? {
        val p = Prefs(ctx)
        val arr = JSONArray(get(ctx, "/rest/v1/profiles?select=*&id=eq.${p.userId}"))
        if (arr.length() == 0) return null
        val o = arr.getJSONObject(0)
        p.name = o.optString("name")
        return if (o.optBoolean("active")) o else null
    }

    fun loadDispositions(ctx: Context): JSONArray {
        val p = Prefs(ctx)
        try {
            val arr = JSONArray(get(ctx, "/rest/v1/settings?select=data&id=eq.1"))
            if (arr.length() > 0) {
                val d = arr.getJSONObject(0).getJSONObject("data").optJSONArray("dispositions")
                if (d != null) p.dispositions = d.toString()
            }
        } catch (e: Exception) { /* use cached copy */ }
        return try { JSONArray(p.dispositions) } catch (e: Exception) { JSONArray() }
    }
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */
object Fmt {
    private val isoFmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    fun iso(ms: Long): String = synchronized(isoFmt) { isoFmt.format(Date(ms)) }
    fun parse(s: String?): Long {
        if (s.isNullOrEmpty() || s == "null") return 0
        return try {
            val clean = s.replace(Regex("(\\.\\d{3})\\d*"), "$1").replace(Regex("\\+00:00$"), "Z")
            val f = if (clean.contains('.')) "yyyy-MM-dd'T'HH:mm:ss.SSSXXX" else "yyyy-MM-dd'T'HH:mm:ssXXX"
            SimpleDateFormat(f, Locale.US).parse(clean)?.time ?: 0
        } catch (e: Exception) { 0 }
    }
    fun when_(ms: Long): String = if (ms == 0L) "" else SimpleDateFormat("d MMM, h:mm a", Locale("en", "IN")).format(Date(ms))
    fun dur(sec: Long): String = if (sec >= 60) "${sec / 60}m ${sec % 60}s" else "${sec}s"
    fun digits(s: String): String = s.filter { it.isDigit() }
    fun e164(s: String): String {
        val d = s.filter { it.isDigit() || it == '+' }
        if (d.startsWith("+")) return d
        val n = d.trimStart('0')
        return if (n.length == 10) "+91$n" else if (n.length == 12 && n.startsWith("91")) "+$n" else n
    }
}

fun Context.has(perm: String) = ContextCompat.checkSelfPermission(this, perm) == PackageManager.PERMISSION_GRANTED

/* ------------------------------------------------------------------ */
/* Phone state: when a call ends, sync the call history                */
/* ------------------------------------------------------------------ */
class CallReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.getStringExtra(TelephonyManager.EXTRA_STATE) == TelephonyManager.EXTRA_STATE_IDLE) {
            // Check the call history right away (background jobs can be delayed for a long time on
            // Samsung and others, which hid the question after incoming calls). Uploads wait for the job.
            val app = ctx.applicationContext
            val done = goAsync()
            Thread {
                try {
                    Thread.sleep(3000)   // give the phone time to write the call into its history
                    val p = Prefs(app)
                    if (p.loggedIn && app.has(android.Manifest.permission.READ_CALL_LOG)) CallSync.run(app, uploads = false)
                } catch (e: Exception) {
                } finally { done.finish() }
            }.start()
            SyncWorker.runSoon(ctx, 20)
        }
    }
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */
object Notify {
    fun askOutcome(ctx: Context, callId: String, leadName: String, leadId: String, seconds: Long, direction: String) {
        if (Build.VERSION.SDK_INT >= 33 && !ctx.has(android.Manifest.permission.POST_NOTIFICATIONS)) return
        val i = Intent(ctx, OutcomeActivity::class.java)
            .putExtra("call_id", callId).putExtra("lead_name", leadName).putExtra("lead_id", leadId)
            .putExtra("seconds", seconds).putExtra("direction", direction)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(ctx, callId.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val what = if (seconds > 0) "Talked ${Fmt.dur(seconds)}" else "Not connected"
        val n = NotificationCompat.Builder(ctx, App.CHANNEL)
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setContentTitle("Log the outcome: $leadName")
            .setContentText("$what. Tap to pick the outcome and set a follow-up.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        try { NotificationManagerCompat.from(ctx).notify(callId.hashCode(), n) } catch (e: SecurityException) { }
    }

    fun cancel(ctx: Context, callId: String) = NotificationManagerCompat.from(ctx).cancel(callId.hashCode())

    /** After a call with a number that is not a lead: ask "Add as lead" or "Personal call". Nothing is saved until they choose. */
    fun askUnknown(ctx: Context, number: String, direction: String, start: Long, seconds: Long, externalId: String) {
        Prefs(ctx).addUnknown(JSONObject().put("number", number).put("direction", direction).put("start", start)
            .put("seconds", seconds).put("external_id", externalId))
        if (Build.VERSION.SDK_INT >= 33 && !ctx.has(android.Manifest.permission.POST_NOTIFICATIONS)) return
        val i = Intent(ctx, UnknownCallActivity::class.java)
            .putExtra("number", number).putExtra("direction", direction).putExtra("start", start)
            .putExtra("seconds", seconds).putExtra("external_id", externalId)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(ctx, externalId.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val what = when { direction == "missed" -> "Missed call"; seconds > 0 -> "Talked ${Fmt.dur(seconds)}"; else -> "Not connected" }
        val n = NotificationCompat.Builder(ctx, App.CHANNEL)
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setContentTitle("New number: $number")
            .setContentText("$what. Not in the CRM. Tap: add as lead, or mark as personal.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        try { NotificationManagerCompat.from(ctx).notify(externalId.hashCode(), n) } catch (e: SecurityException) { }
    }

    fun cancelUnknown(ctx: Context, externalId: String) = NotificationManagerCompat.from(ctx).cancel(externalId.hashCode())
}

object Work {
    val netOnly: Constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
}

fun scheduleNow(ctx: Context, delaySec: Long) {
    val req = OneTimeWorkRequestBuilder<SyncWorker>().setInitialDelay(delaySec, TimeUnit.SECONDS).setConstraints(Work.netOnly).build()
    WorkManager.getInstance(ctx).enqueueUniqueWork("sync-now", ExistingWorkPolicy.APPEND_OR_REPLACE, req)
}

fun scheduleRetry(ctx: Context) {
    val req = OneTimeWorkRequestBuilder<SyncWorker>().setInitialDelay(90, TimeUnit.SECONDS).setConstraints(Work.netOnly).build()
    WorkManager.getInstance(ctx).enqueueUniqueWork("sync-retry", ExistingWorkPolicy.KEEP, req)
}

fun schedulePeriodicSync(ctx: Context) {
    val req = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).setConstraints(Work.netOnly).build()
    WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("sync-periodic", ExistingPeriodicWorkPolicy.KEEP, req)
}
