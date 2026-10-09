package com.dialbook.app

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.PowerManager
import android.provider.Settings
import android.text.InputType
import android.view.View
import android.widget.LinearLayout
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : BaseActivity() {
    private var tab = "leads"
    private var query = ""
    private var permsDone = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        permsDone = getSharedPreferences("dialbook", MODE_PRIVATE).getBoolean("permsDone", false)
    }

    override fun onResume() {
        super.onResume()
        route()
    }

    private fun route() {
        val p = Prefs(this)
        when {
            !p.connected -> connectScreen()
            !p.loggedIn -> loginScreen()
            !corePerms() || !permsDone -> permissionsScreen()
            else -> home()
        }
    }

    private fun corePerms() = has(Manifest.permission.READ_CALL_LOG) && has(Manifest.permission.READ_PHONE_STATE)

    /* ---------------- connect ---------------- */
    private fun connectScreen() {
        val c = page()
        c.add(heading("Connect to your CRM"), 24)
        c.add(text("Ask your admin for the connection code. It is in the Dialbook website under Settings → Phone app. Paste it below.", 15f, MUTED))
        val code = input("Paste connection code", InputType.TYPE_CLASS_TEXT, 4)
        c.add(code, 16)
        c.add(button("Connect") {
            if (Prefs(this).applyCode(code.text.toString())) route() else toast("That code does not look right. Copy it again from Settings → Phone app.")
        }, 16)
    }

    /* ---------------- login ---------------- */
    private fun loginScreen() {
        val c = page()
        c.add(heading("Sign in"), 24)
        c.add(text("Use the same email and password as the Dialbook website.", 15f, MUTED))
        val email = input("Email", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
        val pass = input("Password", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD)
        c.add(email, 16); c.add(pass, 10)
        val msg = text("", 14f, DANGER); c.add(msg, 8)
        lateinit var btn: View
        btn = button("Sign in") {
            btn.isEnabled = false; msg.setTextColor(MUTED); msg.text = "Signing in…"
            io({
                Api.login(this, email.text.toString().trim(), pass.text.toString())
                Api.profile(this)
            }, { prof ->
                btn.isEnabled = true
                if (prof == null) { msg.setTextColor(DANGER); msg.text = "Your account is waiting for approval. Ask your admin to approve you in Team." ; Prefs(this).logout() }
                else { Prefs(this).lastSync = System.currentTimeMillis() - 10 * 60_000; route() }
            }, { e -> btn.isEnabled = true; msg.setTextColor(DANGER); msg.text = e.message ?: "Could not sign in" })
        }
        c.add(btn, 12)
        c.add(button("Use a different connection code", ACCENT, false) { Prefs(this).url = ""; route() }, 24)
    }

    /* ---------------- permissions ---------------- */
    private fun permissionsScreen() {
        val c = page()
        c.add(heading("Allow access"), 24)
        c.add(text("Dialbook needs these so it can log calls with your leads and upload their recordings on its own. Calls with numbers that are not leads are never sent.", 15f, MUTED))

        fun item(titleText: String, detail: String, granted: Boolean, required: Boolean, action: () -> Unit) {
            val k = card()
            k.add(text((if (granted) "✓  " else "") + titleText + if (required) "" else "  (recommended)", 16f, if (granted) CALL else FG, true))
            k.add(text(detail, 14f, MUTED), 4)
            if (!granted) k.add(button("Allow", ACCENT, true, action), 10)
            c.add(k, 12)
        }
        item("Phone and call history", "Reads the call list after each call and lets you call leads with one tap.",
            corePerms() && has(Manifest.permission.CALL_PHONE), true) {
            requestPermissions(arrayOf(Manifest.permission.READ_CALL_LOG, Manifest.permission.READ_PHONE_STATE, Manifest.permission.CALL_PHONE), 1)
        }
        if (Build.VERSION.SDK_INT >= 33) item("Notifications", "Reminds you to pick the call outcome right after a call.",
            has(Manifest.permission.POST_NOTIFICATIONS), false) { requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 2) }
        val audioPerm = if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_AUDIO else Manifest.permission.READ_EXTERNAL_STORAGE
        item("Call recordings", "Finds the recording your phone's dialer saves and uploads it to the lead. Turn on call recording in your phone's dialer settings too.",
            has(audioPerm), false) { requestPermissions(arrayOf(audioPerm), 3) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) item("All files access", "Some phones keep recordings in folders the normal permission cannot see. This lets Dialbook find them.",
            Environment.isExternalStorageManager(), false) {
            try { startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:$packageName"))) }
            catch (e: Exception) { startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)) }
        }
        val pm = getSystemService(PowerManager::class.java)
        item("Run in the background", "Stops the phone from pausing Dialbook, so calls are logged even when the app is closed.",
            pm.isIgnoringBatteryOptimizations(packageName), false) {
            try { startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))) }
            catch (e: Exception) { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
        }
        val cont = button("Continue", if (corePerms()) ACCENT else MUTED) {
            if (!corePerms()) { toast("Allow phone and call history first."); return@button }
            permsDone = true
            getSharedPreferences("dialbook", MODE_PRIVATE).edit().putBoolean("permsDone", true).apply()
            route()
        }
        c.add(cont, 20)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        route()
    }

    /* ---------------- home ---------------- */
    private fun home() {
        val p = Prefs(this)
        val c = page()
        val top = row()
        top.add(text("Hi, ${p.name.ifEmpty { "there" }}", 22f, FG, true), 0, 1f)
        top.add(button("Full CRM", ACCENT, false) { openWeb() }.apply { textSize = 14f }, 8)
        c.add(top, 8)
        val tabs = row()
        listOf("leads" to "My leads", "log" to "To log", "status" to "Status").forEachIndexed { i, (k, label) ->
            tabs.add(chip(label, tab == k) { tab = k; home() }, if (i == 0) 0 else 8)
        }
        c.add(tabs, 12)
        val body = column(0)
        c.add(body, 12)
        when (tab) {
            "leads" -> leadsTab(body)
            "log" -> logTab(body)
            else -> statusTab(body)
        }
        SyncWorker.runSoon(this, 0)
        io({ Api.profile(this) }, { prof -> if (prof == null) pendingScreen() }, { e ->
            if (e is ApiError && e.code == 401) route()
        })
    }

    private fun pendingScreen() {
        val c = page()
        c.add(heading("Waiting for approval"), 24)
        c.add(text("Your admin has not approved your account yet, or it was switched off. Ask them to check Team on the Dialbook website.", 15f, MUTED))
        c.add(button("Check again") { route() }, 16)
        c.add(button("Sign out", ACCENT, false) { Prefs(this).logout(); route() }, 10)
    }

    private fun leadsTab(body: LinearLayout) {
        val p = Prefs(this)
        val search = input("Search name or number").apply { setText(query) }
        val sr = row(); sr.add(search, 0, 1f); sr.add(button("Search", ACCENT, false) { query = search.text.toString().trim(); home() }, 8)
        body.add(sr)
        val list = column(0); body.add(list, 10)
        list.add(text("Loading…", 14f, MUTED))
        var path = "/rest/v1/leads?select=id,name,phone,city,stage,next_follow_up_at,last_outcome,call_count" +
            "&assigned_to=eq.${p.userId}&stage=not.in.(won,lost)&dnd=eq.false&order=next_follow_up_at.asc.nullslast,created_at.asc&limit=200"
        if (query.isNotEmpty()) {
            val q = Uri.encode(query.replace(Regex("[,()*]"), " "))
            path += "&or=(name.ilike.*$q*,phone.ilike.*$q*,city.ilike.*$q*)"
        }
        io({ JSONArray(Api.get(this, path)) }, { arr ->
            list.removeAllViews()
            if (arr.length() == 0) { list.add(text(if (query.isEmpty()) "No open leads assigned to you yet." else "No leads match.", 15f, MUTED)); return@io }
            val now = System.currentTimeMillis()
            for (i in 0 until arr.length()) {
                val l = arr.getJSONObject(i)
                val k = card()
                val r1 = row()
                val info = column(0)
                info.add(text(l.optString("name").ifEmpty { "Unnamed" }, 17f, FG, true))
                info.add(text(l.optString("phone") + (if (l.optString("city").isNotEmpty()) " · " + l.optString("city") else ""), 14f, MUTED))
                val fu = Fmt.parse(l.optString("next_follow_up_at"))
                if (fu > 0) info.add(text((if (fu < now) "Overdue · " else "Follow-up · ") + Fmt.when_(fu), 14f, if (fu < now) DANGER else ACCENT), 2)
                else if (l.optInt("call_count") == 0) info.add(text("New · not called yet", 14f, CALL), 2)
                r1.add(info, 0, 1f)
                val phone = l.optString("phone")
                r1.add(button("Call", CALL) { startCall(phone) }, 8)
                k.add(r1)
                val id = l.getString("id")
                k.setOnClickListener { startActivity(Intent(this, LeadActivity::class.java).putExtra("lead_id", id)) }
                list.add(k, 10)
            }
        }, { e -> list.removeAllViews(); list.add(text(e.message ?: "Could not load leads", 15f, DANGER)) })
    }

    private fun logTab(body: LinearLayout) {
        val p = Prefs(this)
        val unknown = try { JSONArray(p.unknownCalls) } catch (e: Exception) { JSONArray() }
        if (unknown.length() > 0) {
            body.add(text("New numbers", 17f, FG, true))
            body.add(text("Not in the CRM. Tap one: add as lead, or mark as personal (nothing is saved).", 14f, MUTED), 2)
            for (i in unknown.length() - 1 downTo 0) {
                val o = unknown.getJSONObject(i)
                val k = card()
                k.add(text(o.optString("number"), 17f, FG, true))
                val d = o.optLong("seconds"); val dir = o.optString("direction")
                val what = when { dir == "missed" -> "Missed call"; d > 0 -> "${dir.replaceFirstChar { it.uppercase() }} · ${Fmt.dur(d)}"; else -> "${dir.replaceFirstChar { it.uppercase() }} · not connected" }
                k.add(text("$what · ${Fmt.when_(o.optLong("start"))}", 14f, MUTED), 2)
                k.setOnClickListener {
                    startActivity(Intent(this, UnknownCallActivity::class.java).putExtra("number", o.optString("number"))
                        .putExtra("direction", dir).putExtra("start", o.optLong("start")).putExtra("seconds", d)
                        .putExtra("external_id", o.optString("external_id")))
                }
                body.add(k, 8)
            }
            body.add(text("Calls with leads", 17f, FG, true), 18)
        }
        body.add(text("Calls with leads that still need an outcome. Tap one to log it. Callbacks you set appear in My leads (Follow-up / Overdue).", 14f, MUTED))
        val list = column(0); body.add(list, 10)
        list.add(text("Loading…", 14f, MUTED))
        io({
            try { JSONArray(Api.rpc(this, "calls_to_log", JSONObject().put("p_days", 3))) }
            catch (e: ApiError) {
                if (e.code != 404) throw e
                // Database not updated yet: older list (names only for your own leads)
                val since = Fmt.iso(System.currentTimeMillis() - 3 * 86_400_000L)
                val old = JSONArray(Api.get(this, "/rest/v1/calls?select=id,started_at,duration,direction,lead_id,lead:leads(name,phone)" +
                    "&agent_id=eq.${p.userId}&outcome=is.null&started_at=gte.$since&order=started_at.desc&limit=50"))
                for (i in 0 until old.length()) {
                    val o = old.getJSONObject(i); val l = o.optJSONObject("lead")
                    o.put("lead_name", l?.optString("name") ?: ""); o.put("lead_phone", l?.optString("phone") ?: "")
                }
                old
            }
        }, { arr ->
            list.removeAllViews()
            if (arr.length() == 0) { list.add(text("All caught up.", 15f, MUTED)); return@io }
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val name = o.optString("lead_name").let { if (it.isEmpty() || it == "null") "Lead" else it }
                val phone = o.optString("lead_phone").let { if (it == "null") "" else it }
                val k = card()
                val r1 = row(); val info = column(0)
                info.add(text(name, 17f, FG, true))
                if (phone.isNotEmpty()) info.add(text(phone, 14f, MUTED))
                val d = o.optLong("duration")
                info.add(text("${o.optString("direction").replaceFirstChar { it.uppercase() }} · ${if (d > 0) Fmt.dur(d) else "not connected"} · ${Fmt.when_(Fmt.parse(o.optString("started_at")))}", 14f, MUTED), 2)
                r1.add(info, 0, 1f)
                if (phone.isNotEmpty()) r1.add(button("Call", CALL) { startCall(phone) }, 8)
                k.add(r1)
                val callId = o.getString("id"); val leadId = o.optString("lead_id"); val dir = o.optString("direction")
                k.setOnClickListener {
                    startActivity(Intent(this, OutcomeActivity::class.java).putExtra("call_id", callId).putExtra("lead_name", name)
                        .putExtra("lead_id", leadId).putExtra("seconds", d).putExtra("direction", dir))
                }
                list.add(k, 10)
            }
        }, { e -> list.removeAllViews(); list.add(text(e.message ?: "Could not load calls", 15f, DANGER)) })
    }

    private fun statusTab(body: LinearLayout) {
        val p = Prefs(this)
        val k = card()
        fun line(label: String, value: String, color: Int = FG) {
            val r = row(); r.add(text(label, 14f, MUTED), 0, 1f); r.add(text(value, 14f, color, true), 8); k.add(r, 6)
        }
        line("Signed in as", p.email)
        line("Calls logged by this phone", p.callsLogged.toString())
        line("Recordings uploaded", p.recordingsUploaded.toString())
        line("Recordings waiting", Recordings.pendingCount(this).toString())
        line("Last check", if (p.lastRun == 0L) "Not yet" else Fmt.when_(p.lastRun))
        line("Can read recordings", if (Recordings.canRead(this)) "Yes" else "No", if (Recordings.canRead(this)) CALL else DANGER)
        if (p.lastError.isNotEmpty()) k.add(text("Last problem: ${p.lastError}", 14f, DANGER), 8)
        body.add(k)

        body.add(button("Check for new calls now") {
            io({ CallSync.run(this) }, { toast("Done"); home() }, { e -> toast(e.message ?: "Check failed") })
        }, 12)

        val rk = card()
        rk.add(text("Call recordings", 16f, FG, true))
        rk.add(text("Turn on automatic call recording in your phone's own dialer (Phone app → Settings → Record calls). Dialbook finds each recording and uploads it to the lead.", 14f, MUTED), 4)
        rk.add(chip(if (p.recordingsEnabled) "Uploading recordings: On" else "Uploading recordings: Off", p.recordingsEnabled) {
            p.recordingsEnabled = !p.recordingsEnabled; home()
        }, 10)
        val folder = input("Extra folder, e.g. Recordings/MyCalls").apply { setText(p.extraFolder) }
        rk.add(text("If your phone saves recordings somewhere unusual, type the folder here:", 14f, MUTED), 10)
        rk.add(folder, 6)
        rk.add(button("Save folder", ACCENT, false) { p.extraFolder = folder.text.toString().trim(); toast("Saved") }, 8)
        body.add(rk, 12)

        body.add(button("Review permissions", ACCENT, false) { permsDone = false; permissionsScreen() }, 12)
        body.add(button("Sign out", DANGER, false) { p.logout(); route() }, 10)
    }
}
