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
    private var filter = "all"
    private var chatUnread = 0

    private fun home() {
        val p = Prefs(this)
        val h = header()
        val top = row()
        top.addView(avatar(p.name, 44, GOLD))
        val who = column(0).apply { setPadding(dp(12), 0, 0, 0) }
        who.add(text("Hi, ${p.name.trim().split(" ").firstOrNull()?.ifEmpty { null } ?: "there"}", 20f, android.graphics.Color.WHITE, true))
        who.add(text(java.text.SimpleDateFormat("EEEE, d MMMM", java.util.Locale("en", "IN")).format(java.util.Date()), 13f, ON_NAVY))
        top.add(who, 0, 1f)
        val web = row().apply {
            background = rounded(android.graphics.Color.argb(26, 255, 255, 255), GOLD, 20); setPadding(dp(12), dp(8), dp(12), dp(8))
            addView(icon(R.drawable.ic_web, GOLD_HI, 16))
            addView(text("Full CRM", 13f, GOLD_HI, true).apply { setPadding(dp(6), 0, 0, 0) })
            isClickable = true; setOnClickListener { openWeb() }
        }
        top.add(web, 8)
        h.add(top)
        val target = column(0); h.add(target, 0)
        loadTarget(target)

        val unknown = try { JSONArray(p.unknownCalls).length() } catch (e: Exception) { 0 }
        val nav = bottomNav(listOf(Triple("leads", "My leads", R.drawable.ic_people), Triple("fu", "Follow-ups", R.drawable.ic_clock),
            Triple("log", "To log", R.drawable.ic_tolog), Triple("chat", "Chat", R.drawable.ic_chat), Triple("status", "Status", R.drawable.ic_status)),
            tab, mapOf("log" to unknown, "chat" to chatUnread)) { tab = it; home() }
        val body = shell(h, nav)
        when (tab) {
            "leads" -> leadsTab(body)
            "fu" -> followUpsTab(body)
            "log" -> logTab(body)
            "chat" -> chatTab(body)
            else -> statusTab(body)
        }
        if (tab != "chat") io({ Api.rpc(this, "team_unread", JSONObject()).trim().toIntOrNull() ?: 0 }, { n ->
            if (n != chatUnread) { chatUnread = n; home() }
        }, { })
        SyncWorker.runSoon(this, 0)
        io({ Api.profile(this) }, { prof -> if (prof == null) pendingScreen() }, { e ->
            if (e is ApiError && e.code == 401) route()
        })
    }

    /** Today's calls, connected calls and conversions against the targets set in Settings → Daily targets. */
    private fun loadTarget(box: LinearLayout) {
        io({ JSONArray(Api.rpc(this, "today_progress", JSONObject().put("p_tz", "Asia/Kolkata").put("p_all", false))) }, { arr ->
            box.removeAllViews()
            if (arr.length() == 0) return@io
            val r = arr.getJSONObject(0); val t = r.optJSONObject("target") ?: JSONObject()
            val items = listOf(Triple("Calls today", "calls", "calls"), Triple("Connected", "connected", "connected"), Triple("Converted", "converted", "converted"))
                .filter { t.optInt(it.third) > 0 }
            if (items.isEmpty()) return@io
            val r1 = row().apply { background = rounded(android.graphics.Color.argb(22, 255, 255, 255), 0, 16); setPadding(dp(14), dp(12), dp(14), dp(12)) }
            items.forEachIndexed { i, (label, key, tk) ->
                val v = r.optInt(key); val g = t.optInt(tk)
                val col = column(0)
                val num = row()
                num.addView(text("$v", 22f, android.graphics.Color.WHITE, true))
                num.addView(text(" / $g", 13f, ON_NAVY))
                col.add(num)
                col.add(text(label, 11f, ON_NAVY), 0)
                val bar = android.widget.ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
                    max = g; progress = minOf(v, g)
                    progressTintList = android.content.res.ColorStateList.valueOf(if (v >= g) android.graphics.Color.parseColor("#3FCF80") else GOLD_HI)
                    progressBackgroundTintList = android.content.res.ColorStateList.valueOf(android.graphics.Color.argb(60, 255, 255, 255))
                }
                col.add(bar, 4)
                r1.add(col, if (i == 0) 0 else 14, 1f)
            }
            box.add(r1, 14)
            val left = t.optInt("calls") - r.optInt("calls")
            val due = r.optInt("due")
            val note = listOfNotNull(if (t.optInt("calls") > 0) (if (left > 0) "$left more calls to go" else "Calls target reached 🎉") else null,
                if (due > 0) "$due follow-ups due today" else null).joinToString(" · ")
            if (note.isNotEmpty()) box.add(text(note, 13f, ON_NAVY), 8)
        }, { /* database not updated yet, or offline: no target card */ })
    }

    /** One lead as a card: initials, name, number, what is next, and a Call button. */
    private fun leadCard(l: JSONObject): LinearLayout {
        val now = System.currentTimeMillis()
        val k = card()
        val r1 = row()
        r1.addView(avatar(l.optString("name").ifEmpty { "?" }))
        val info = column(0).apply { setPadding(dp(12), 0, dp(8), 0) }
        info.add(text((if (l.optString("priority") == "hot") "🔥 " else "") + l.optString("name").ifEmpty { "Unnamed" }, 17f, FG, true))
        val city = l.optString("city").let { if (it == "null") "" else it }
        info.add(text(l.optString("phone") + (if (city.isNotEmpty()) " · $city" else ""), 14f, MUTED), 2)
        val fu = Fmt.parse(l.optString("next_follow_up_at"))
        val st = row()
        st.addView(pill(l.optString("stage").replace('_', ' ').replaceFirstChar { it.uppercase() }, FG, BG))
        when {
            fu in 1L until now -> st.add(text("Overdue · " + Fmt.when_(fu), 13f, DANGER, true), 8)
            fu > 0 -> st.add(text(Fmt.when_(fu), 13f, ACCENT, true), 8)
            l.optInt("call_count") == 0 -> st.add(text("Not called yet", 13f, CALL, true), 8)
        }
        info.add(st, 6)
        r1.add(info, 0, 1f)
        r1.addView(callButton(l.optString("phone")))
        k.add(r1)
        val id = l.getString("id")
        k.setOnClickListener { startActivity(Intent(this, LeadActivity::class.java).putExtra("lead_id", id)) }
        return k
    }

    private fun endOfToday(): Long = java.util.Calendar.getInstance().apply {
        set(java.util.Calendar.HOUR_OF_DAY, 23); set(java.util.Calendar.MINUTE, 59); set(java.util.Calendar.SECOND, 59)
    }.timeInMillis

    private fun leadsTab(body: LinearLayout) {
        val p = Prefs(this)
        val sr = row().apply { background = rounded(SURFACE, LINE, 14); setPadding(dp(12), dp(2), dp(4), dp(2)) }
        sr.addView(icon(R.drawable.ic_search, MUTED, 20))
        val search = input("Search name or number").apply { setText(query); background = null; imeOptions = android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH }
        search.setOnEditorActionListener { _, _, _ -> query = search.text.toString().trim(); home(); true }
        sr.add(search, 0, 1f)
        sr.add(chip("Search", false) { query = search.text.toString().trim(); home() }, 4)
        body.add(sr)
        val (hs, chips) = chipRow()
        listOf("all" to "All", "hot" to "🔥 Hot", "new" to "New", "overdue" to "Overdue", "today" to "Due today").forEachIndexed { i, (k, label) ->
            chips.add(chip(label, filter == k) { filter = k; home() }, if (i == 0) 0 else 8)
        }
        body.add(hs, 12)
        val list = column(0); body.add(list, 12)
        list.add(text("Loading…", 14f, MUTED))
        var path = "/rest/v1/leads?select=id,name,phone,city,stage,next_follow_up_at,last_outcome,call_count,priority" +
            "&assigned_to=eq.${p.userId}&stage=not.in.(won,lost)&dnd=eq.false&order=next_follow_up_at.asc.nullslast,created_at.asc&limit=200"
        when (filter) {
            "hot" -> path += "&priority=eq.hot"
            "new" -> path += "&call_count=eq.0"
            "overdue" -> path += "&next_follow_up_at=lt.${Uri.encode(Fmt.iso(System.currentTimeMillis()))}"
            "today" -> path += "&next_follow_up_at=lt.${Uri.encode(Fmt.iso(endOfToday()))}"
        }
        if (query.isNotEmpty()) {
            val q = Uri.encode(query.replace(Regex("[,()*]"), " "))
            path += "&or=(name.ilike.*$q*,phone.ilike.*$q*,city.ilike.*$q*)"
        }
        io({ JSONArray(Api.get(this, path)) }, { arr ->
            list.removeAllViews()
            if (arr.length() == 0) {
                list.add(emptyState(if (query.isEmpty() && filter == "all") "No open leads assigned to you yet." else "No leads match."))
                return@io
            }
            list.add(section("${arr.length()} lead${if (arr.length() == 1) "" else "s"}"))
            for (i in 0 until arr.length()) list.add(leadCard(arr.getJSONObject(i)), if (i == 0) 8 else 10)
        }, { e -> list.removeAllViews(); list.add(text(e.message ?: "Could not load leads", 15f, DANGER)) })
    }

    private fun emptyState(msg: String): LinearLayout = card().apply {
        gravity = android.view.Gravity.CENTER; setPadding(dp(16), dp(28), dp(16), dp(28))
        add(text("✓", 28f, CALL, true).apply { gravity = android.view.Gravity.CENTER })
        add(text(msg, 15f, MUTED).apply { gravity = android.view.Gravity.CENTER }, 6)
    }

    private fun followUpsTab(body: LinearLayout) {
        val p = Prefs(this)
        val list = column(0); body.add(list)
        list.add(text("Loading…", 14f, MUTED))
        val path = "/rest/v1/leads?select=id,name,phone,city,stage,next_follow_up_at,last_outcome,call_count,priority" +
            "&assigned_to=eq.${p.userId}&stage=not.in.(won,lost)&dnd=eq.false&next_follow_up_at=lt.${Uri.encode(Fmt.iso(endOfToday()))}" +
            "&order=next_follow_up_at.asc&limit=200"
        io({ JSONArray(Api.get(this, path)) }, { arr ->
            list.removeAllViews()
            if (arr.length() == 0) { list.add(emptyState("No follow-ups due today. 🎉")); return@io }
            val now = System.currentTimeMillis()
            val all = (0 until arr.length()).map { arr.getJSONObject(it) }
            val over = all.filter { Fmt.parse(it.optString("next_follow_up_at")) < now }
            val later = all - over.toSet()
            var top = 0
            if (over.isNotEmpty()) {
                list.add(text("Overdue · ${over.size}", 15f, DANGER, true))
                over.forEach { list.add(leadCard(it), 8) }
                top = 18
            }
            if (later.isNotEmpty()) {
                list.add(text("Later today · ${later.size}", 15f, ACCENT, true), top)
                later.forEach { list.add(leadCard(it), 8) }
            }
        }, { e -> list.removeAllViews(); list.add(text(e.message ?: "Could not load follow-ups", 15f, DANGER)) })
    }

    /** Team chat: everyone, then each colleague, newest conversation first. */
    private fun chatTab(body: LinearLayout) {
        val me = Prefs(this).userId
        body.add(section("Team chat"))
        val list = column(0); body.add(list, 8)
        list.add(text("Loading…", 14f, MUTED))
        io({ Pair(TeamChat.people(this), JSONArray(Api.rpc(this, "team_inbox", JSONObject()))) }, { (names, inbox) ->
            list.removeAllViews()
            val by = (0 until inbox.length()).associate { inbox.getJSONObject(it).let { o -> o.optString("channel") to o } }
            val rows = listOf("team" to "Everyone") + names.filterKeys { it != me }.map { (id, n) -> TeamChat.dm(me, id) to n }
                .sortedWith(compareByDescending<Pair<String, String>> { Fmt.parse(by[it.first]?.optString("last_at")) }.thenBy { it.second })
            var total = 0
            rows.forEachIndexed { i, (ch, name) ->
                val o = by[ch]
                val k = card(); val r = row()
                r.addView(if (ch == "team") avatar("Team", 44, NAVY) else avatar(name))
                val info = column(0).apply { setPadding(dp(12), 0, dp(8), 0) }
                val last = o?.optString("last_body")?.let { if (it == "null") "" else it } ?: ""
                info.add(text(name, 16f, FG, true))
                info.add(text(when {
                    last.isNotEmpty() -> (if (o?.optString("last_sender") == me) "You: " else "") + last
                    ch == "team" -> "Messages for the whole team"
                    else -> "Tap to chat"
                }, 14f, MUTED).apply { maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.END }, 2)
                r.add(info, 0, 1f)
                val at = Fmt.parse(o?.optString("last_at"))
                val side = column(0).apply { gravity = android.view.Gravity.END }
                if (at > 0) side.add(text(Fmt.when_(at).substringAfter(", "), 12f, MUTED))
                val n = o?.optInt("unread") ?: 0
                total += n
                if (n > 0) side.add(pill(n.toString(), android.graphics.Color.WHITE, android.graphics.Color.parseColor("#3A7BD5")), 4, 0f, android.view.ViewGroup.LayoutParams.WRAP_CONTENT)
                r.addView(side)
                k.add(r)
                k.setOnClickListener { startActivity(Intent(this, ChatActivity::class.java).putExtra("channel", ch).putExtra("title", name)) }
                list.add(k, if (i == 0) 0 else 8)
            }
            chatUnread = total
        }, { e -> list.removeAllViews(); list.add(text(if (e is ApiError && e.code == 404) "Team chat is not switched on yet. Ask your admin to run supabase/team-chat.sql." else (e.message ?: "Could not load chats"), 15f, DANGER)) })
    }

    private fun pendingScreen() {
        val c = page()
        c.add(heading("Waiting for approval"), 24)
        c.add(text("Your admin has not approved your account yet, or it was switched off. Ask them to check Team on the Dialbook website.", 15f, MUTED))
        c.add(button("Check again") { route() }, 16)
        c.add(button("Sign out", ACCENT, false) { Prefs(this).logout(); route() }, 10)
    }

    private fun logTab(body: LinearLayout) {
        val p = Prefs(this)
        val unknown = try { JSONArray(p.unknownCalls) } catch (e: Exception) { JSONArray() }
        if (unknown.length() > 0) {
            body.add(section("New numbers · ${unknown.length()}"))
            body.add(text("Not in the CRM. Tap one: add as lead, or mark as personal (nothing is saved).", 13f, MUTED), 4)
            for (i in unknown.length() - 1 downTo 0) {
                val o = unknown.getJSONObject(i)
                val k = card(); val r = row()
                r.addView(avatar("?", 44, WARN))
                val info = column(0).apply { setPadding(dp(12), 0, 0, 0) }
                info.add(text(o.optString("number"), 17f, FG, true))
                val d = o.optLong("seconds"); val dir = o.optString("direction")
                val what = when { dir == "missed" -> "Missed call"; d > 0 -> "${dir.replaceFirstChar { it.uppercase() }} · ${Fmt.dur(d)}"; else -> "${dir.replaceFirstChar { it.uppercase() }} · not connected" }
                info.add(text("$what · ${Fmt.when_(o.optLong("start"))}", 14f, MUTED), 2)
                info.add(text("Tap to decide", 13f, ACCENT, true), 4)
                r.add(info, 0, 1f); k.add(r)
                k.setOnClickListener {
                    startActivity(Intent(this, UnknownCallActivity::class.java).putExtra("number", o.optString("number"))
                        .putExtra("direction", dir).putExtra("start", o.optLong("start")).putExtra("seconds", d)
                        .putExtra("external_id", o.optString("external_id")))
                }
                body.add(k, 8)
            }
        }
        body.add(section("Calls to log"), if (unknown.length() > 0) 20 else 0)
        body.add(text("Calls with leads that still need an outcome. Tap one to log it.", 13f, MUTED), 4)
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
            if (arr.length() == 0) { list.add(emptyState("All caught up.")); return@io }
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val name = o.optString("lead_name").let { if (it.isEmpty() || it == "null") "Lead" else it }
                val phone = o.optString("lead_phone").let { if (it == "null") "" else it }
                val k = card()
                val r1 = row(); val info = column(0).apply { setPadding(dp(12), 0, dp(8), 0) }
                r1.addView(avatar(name))
                info.add(text(name, 17f, FG, true))
                if (phone.isNotEmpty()) info.add(text(phone, 14f, MUTED), 2)
                val d = o.optLong("duration")
                info.add(text("${o.optString("direction").replaceFirstChar { it.uppercase() }} · ${if (d > 0) Fmt.dur(d) else "not connected"} · ${Fmt.when_(Fmt.parse(o.optString("started_at")))}", 13f, MUTED), 2)
                info.add(pill("Add outcome", ACCENT, ACCENT_SOFT), 6, 0f, android.view.ViewGroup.LayoutParams.WRAP_CONTENT)
                r1.add(info, 0, 1f)
                if (phone.isNotEmpty()) r1.addView(callButton(phone))
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
