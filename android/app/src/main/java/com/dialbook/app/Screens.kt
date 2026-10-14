package com.dialbook.app

import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/* ------------------------------------------------------------------ */
/* One lead: details, call button, recent calls                        */
/* ------------------------------------------------------------------ */
class LeadActivity : BaseActivity() {
    private lateinit var leadId: String
    /** The lead's course (its campaign's course details), for the application form message. */
    var course = ""
    /** The course has no application form (Campaigns → Edit). */
    var noForm = false
    var formKind = ""
    /** The course's certificate specimen links and who gives the certificate (Campaigns → Edit). */
    var specimen = ""
    var certBy = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        leadId = intent.getStringExtra("lead_id") ?: run { finish(); return }
    }

    override fun onResume() {
        super.onResume()
        if (::leadId.isInitialized) load()
    }

    fun transfer(name: String) = transferImpl(leadId, name)

    private fun load() {
        val h = header()
        h.add(headerTop("Lead") { finish() })
        val hb = column(0); h.add(hb, 12)
        val c = shell(h)
        val box = column(0); c.add(box)
        box.add(text("Loading…", 14f, MUTED))
        io({
            val l = JSONArray(Api.get(this, "/rest/v1/leads?select=*&id=eq.$leadId"))
            val calls = JSONArray(Api.get(this, "/rest/v1/calls?select=*&lead_id=eq.$leadId&order=started_at.desc&limit=20"))
            val dispos = Api.loadDispositions(this)
            Triple(l, calls, dispos)
        }, { (arr, calls, dispos) ->
            val settings = try { JSONObject(Prefs(this).settingsJson) } catch (e: Exception) { JSONObject() }
            box.removeAllViews()
            if (arr.length() == 0) { box.add(text("This lead is not assigned to you any more.", 15f, MUTED)); return@io }
            val l = arr.getJSONObject(0)
            val name = l.optString("name").ifEmpty { "Unnamed" }
            val phone = l.optString("phone")
            val city = l.optString("city").let { if (it == "null") "" else it }
            hb.removeAllViews()
            val who = row()
            who.addView(avatar(name, 56, GOLD))
            val wc = column(0).apply { setPadding(dp(14), 0, 0, 0) }
            wc.add(text((if (l.optString("priority") == "hot") "🔥 " else "") + name, 22f, android.graphics.Color.WHITE, true))
            wc.add(text(phone + (if (city.isNotEmpty()) " · $city" else ""), 15f, ON_NAVY), 2)
            wc.add(pill(l.optString("stage").replace('_', ' ').replaceFirstChar { it.uppercase() }, NAVY, GOLD_HI), 8, 0f, android.view.ViewGroup.LayoutParams.WRAP_CONTENT)
            who.add(wc, 0, 1f)
            hb.add(who)

            val tiles = row().apply { gravity = android.view.Gravity.FILL_VERTICAL }
            tiles.add(tile(R.drawable.ic_call, "Call", android.graphics.Color.WHITE, CALL) { startCall(phone) }, 0, 1f)
            tiles.add(tile(R.drawable.ic_chat, "WhatsApp", CALL, CALL_SOFT) { openWhatsApp(phone) }, 8, 1f)
            tiles.add(tile(R.drawable.ic_chat, "Company WA", ACCENT, ACCENT_SOFT) { openWeb("wa:$leadId") }, 8, 1f)
            tiles.add(tile(R.drawable.ic_transfer, "Transfer", NAVY, android.graphics.Color.parseColor("#E6EAF4")) { transfer(name) }, 8, 1f)
            box.add(tiles)
            box.add(text("WhatsApp opens your own WhatsApp. Company WA sends templates from the company number, saved in the CRM.", 12f, MUTED), 6)
            val more = row()
            more.add(button("💬  Team chat", NAVY, false) { shareLeadInChat(leadId, name) }, 0, 1f)
            more.add(button("📄  Send form", ACCENT, false) { if (noForm) toast("This course has no application form") else sendApplicationForm(name, phone, course, formKind) }, 8, 1f)
            box.add(more, 10)
            box.add(button("🎓  Send certificate sample", NAVY, false) { sendCertificate(name, phone, course, certBy, specimen) }, 8)
            val fu = Fmt.parse(l.optString("next_follow_up_at"))
            if (fu > 0) {
                val late = fu < System.currentTimeMillis()
                val k = card(); val r = row()
                r.addView(icon(R.drawable.ic_clock, if (late) DANGER else ACCENT, 22))
                r.add(column(0).apply {
                    setPadding(dp(12), 0, 0, 0)
                    add(text(if (late) "Follow-up overdue" else "Next follow-up", 12f, MUTED, true))
                    add(text(Fmt.when_(fu), 16f, if (late) DANGER else FG, true), 2)
                }, 0, 1f)
                k.add(r); box.add(k, 14)
            }
            if (l.optString("note").isNotEmpty()) {
                val k = card(); k.add(section("Notes")); k.add(text(l.optString("note"), 15f), 6); box.add(k, 12)
            }
            val scriptBox = column(0); box.add(scriptBox, 12)
            loadScript(scriptBox, l, settings)
            box.add(section("Recent calls"), 20)
            if (calls.length() == 0) box.add(text("No calls yet.", 14f, MUTED), 6)
            for (i in 0 until calls.length()) {
                val o = calls.getJSONObject(i)
                val k = card()
                val outcome = o.optString("outcome")
                val oname = if (outcome.isEmpty() || outcome == "null") "Outcome not logged" else dispoName(dispos, outcome)
                k.add(text(oname, 15f, FG, true))
                val src = when (o.optString("source")) { "phone" -> "Phone app"; "ai" -> "AI agent"; else -> "Logged by hand" }
                val rec = if (!o.isNull("recording_path") || !o.isNull("recording_url")) " · recorded" else ""
                k.add(text("${Fmt.when_(Fmt.parse(o.optString("started_at")))} · ${Fmt.dur(o.optLong("duration"))} · $src$rec", 13f, MUTED), 2)
                val note = o.optString("note"); if (note.isNotEmpty() && note != "null") k.add(text(note, 14f), 4)
                if (outcome.isEmpty() || outcome == "null") {
                    val callId = o.getString("id"); val d = o.optLong("duration"); val dir = o.optString("direction")
                    k.add(button("Add outcome", ACCENT) {
                        startActivity(Intent(this, OutcomeActivity::class.java).putExtra("call_id", callId).putExtra("lead_name", name)
                            .putExtra("lead_id", leadId).putExtra("seconds", d).putExtra("direction", dir))
                    }, 8)
                }
                box.add(k, 8)
            }
        }, { e -> box.removeAllViews(); box.add(text(e.message ?: "Could not load this lead", 15f, DANGER)) })
    }
}

/** The best call script for this lead (Settings → Call scripts, then the program's own script). Tap to open or close it. */
private fun LeadActivity.loadScript(box: LinearLayout, l: JSONObject, settings: JSONObject) {
    val campId = l.optString("campaign_id").let { if (it == "null") "" else it }
    io({
        if (campId.isEmpty()) JSONArray() else JSONArray(Api.get(this, "/rest/v1/campaigns?select=*&id=eq.$campId"))
    }, { arr ->
        val camp = if (arr.length() > 0) arr.getJSONObject(0) else JSONObject()
        val det = camp.optJSONObject("details") ?: JSONObject()
        val co = det.optString("course")
        course = co
        noForm = det.optString("form") == "none"; formKind = det.optString("form")
        specimen = det.optString("specimen"); certBy = det.optString("cert")
        val lang = l.optString("language").lowercase()
        var best: JSONObject? = null; var bs = -1
        val list = settings.optJSONArray("scripts") ?: JSONArray()
        for (i in 0 until list.length()) {
            val x = list.getJSONObject(i)
            if (x.optString("body").isBlank()) continue
            val xc = x.optString("campaign_id"); val xk = x.optString("course"); val xl = x.optString("language").lowercase()
            if (xc.isNotEmpty() && xc != campId) continue
            if (xk.isNotEmpty() && xk != co) continue
            if (xl.isNotEmpty() && xl != lang) continue
            val sc = (if (xc.isNotEmpty()) 8 else if (xk.isNotEmpty()) 4 else 0) + (if (xl.isNotEmpty()) 2 else 0)
            if (sc > bs) { bs = sc; best = x }
        }
        val campScript = camp.optString("script").let { if (it == "null") "" else it }
        val (title, body) = when {
            best != null && bs >= 4 -> best!!.optString("name").ifEmpty { "Call script" } to best!!.optString("body")
            campScript.isNotBlank() -> camp.optString("name") to campScript
            best != null -> best!!.optString("name").ifEmpty { "Call script" } to best!!.optString("body")
            else -> return@io
        }
        val first = l.optString("name").trim().split(" ").firstOrNull()?.ifEmpty { null } ?: "there"
        val filled = body.replace("{first_name}", first).replace("{name}", first)
            .replace("{program}", camp.optString("name")).replace("{city}", l.optString("city"))
            .replace("{agent}", Prefs(this).name).replace("{company}", settings.optString("company"))
            .replace("{course}", co.ifEmpty { camp.optString("name") })
            .replace("{fee}", det.optString("fee")).replace("{duration}", det.optString("duration"))
            .replace("{timing}", det.optString("timing")).replace("{dates}", det.optString("dates"))
            .replace("{venue}", det.optString("venue")).replace("{phone}", l.optString("phone"))
            .replace("{certificate}", det.optString("cert")).replace("{payment}", det.optString("payment"))
        val k = card()
        k.add(text("▸ Call script · $title", 15f, BaseActivity.ACCENT, true))
        val tv = text(filled, 15f, BaseActivity.FG).apply { visibility = android.view.View.GONE }
        k.add(tv, 6)
        k.setOnClickListener {
            val open = tv.visibility != android.view.View.VISIBLE
            tv.visibility = if (open) android.view.View.VISIBLE else android.view.View.GONE
            (k.getChildAt(0) as TextView).text = (if (open) "▾" else "▸") + " Call script · $title"
        }
        box.add(k)
    }, { /* no script */ })
}

/** Pass this lead to a colleague, with a reason (e.g. "Telugu lead"). */
private fun LeadActivity.transferImpl(leadId: String, leadName: String) {
    val me = Prefs(this).userId
    io({ JSONArray(Api.get(this, "/rest/v1/profiles?select=id,name,languages&active=eq.true&order=name.asc")) }, { arr ->
        val people = (0 until arr.length()).map { arr.getJSONObject(it) }.filter { it.optString("id") != me }
        if (people.isEmpty()) { toast("No colleagues to transfer to"); return@io }
        val labels = people.map { o ->
            val langs = o.optJSONArray("languages")?.let { a -> (0 until a.length()).joinToString(", ") { a.optString(it) } } ?: ""
            o.optString("name") + if (langs.isNotEmpty()) " ($langs)" else ""
        }.toTypedArray()
        android.app.AlertDialog.Builder(this).setTitle("Transfer $leadName to").setItems(labels) { _, which ->
            val to = people[which]
            val reason = android.widget.EditText(this).apply { hint = "Reason, e.g. Telugu lead"; setSingleLine() }
            android.app.AlertDialog.Builder(this).setTitle("Transfer to ${to.optString("name")}").setView(reason)
                .setPositiveButton("Transfer") { _, _ ->
                    val note = reason.text.toString().trim()
                    if (note.length < 2) { toast("Add a short reason"); return@setPositiveButton }
                    io({ Api.rpc(this, "transfer_lead", JSONObject().put("p_lead", leadId).put("p_to", to.optString("id")).put("p_note", note)) }, {
                        toast("Transferred to ${to.optString("name")}"); finish()
                    }, { e -> toast(if (e is ApiError && e.code == 404) "Ask your admin to run supabase/transfer.sql" else (e.message ?: "Could not transfer")) })
                }.setNegativeButton("Cancel", null).show()
        }.setNegativeButton("Cancel", null).show()
    })
}

fun dispoName(dispos: JSONArray, id: String): String {
    for (i in 0 until dispos.length()) { val d = dispos.getJSONObject(i); if (d.optString("id") == id) return d.optString("name") }
    return id
}

/* ------------------------------------------------------------------ */
/* After a call: pick the outcome, notes and follow-up                 */
/* ------------------------------------------------------------------ */
class OutcomeActivity : BaseActivity() {
    private var picked: JSONObject? = null
    private var followUp: Long = 0
    private var fuLabel: TextView? = null
    private val dispoViews = mutableListOf<Pair<String, TextView>>()
    private var lostReason = ""
    private var lostBox: LinearLayout? = null
    private val reasonViews = mutableListOf<Pair<String, TextView>>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val callId = intent.getStringExtra("call_id") ?: run { finish(); return }
        val leadName = intent.getStringExtra("lead_name") ?: "Lead"
        val seconds = intent.getLongExtra("seconds", 0)
        val h = header()
        h.add(headerTop("How did the call go?") { finish() })
        val hr = row()
        hr.addView(avatar(leadName, 48, GOLD))
        hr.add(column(0).apply {
            setPadding(dp(12), 0, 0, 0)
            add(text(leadName, 19f, android.graphics.Color.WHITE, true))
            add(text(if (seconds > 0) "Talked for ${Fmt.dur(seconds)}" else "The call did not connect", 14f, ON_NAVY), 2)
        }, 0, 1f)
        h.add(hr, 12)
        val c = shell(h)
        c.add(section("Call outcome"))

        val list = column(0); c.add(list, 8)
        list.add(text("Loading outcomes…", 14f, MUTED))
        lostBox = column(0).apply { visibility = android.view.View.GONE }
        c.add(lostBox!!, 14)

        c.add(section("Next follow-up"), 20)
        val (hs, chips) = chipRow()
        val options = listOf("1 hr" to 1, "3 hrs" to 3, "Tomorrow 11 AM" to 24, "2 days" to 48, "1 week" to 168, "None" to 0)
        options.forEachIndexed { i, (label, hrs) -> chips.add(chip(label, false) { setFollowUp(hrs) }, if (i == 0) 0 else 8) }
        c.add(hs, 8)
        fuLabel = text("No follow-up", 14f, MUTED); c.add(fuLabel!!, 6)

        val notes = input("Notes: what did they say?", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES, 3)
        c.add(notes, 16)
        val save = button("Save outcome", ACCENT) {
            val d = picked ?: run { toast("Pick an outcome first"); return@button }
            val askReason = needsReason(d)
            if (askReason && lostReason.isEmpty()) { toast("Pick why the lead is lost"); return@button }
            val args = JSONObject().put("p_call", callId).put("p_outcome", d.getString("id")).put("p_note", notes.text.toString().trim())
                .put("p_follow_up", if (followUp > 0) Fmt.iso(followUp) else JSONObject.NULL)
            val leadId = intent.getStringExtra("lead_id") ?: ""
            io({
                Api.rpc(this, "set_call_outcome", args)
                if (askReason && leadId.isNotEmpty()) {
                    try { Api.rpc(this, "set_lost_reason", JSONObject().put("p_lead", leadId).put("p_reason", lostReason)) }
                    catch (e: ApiError) { if (e.code != 404) throw e }   // database not updated yet
                }
            }, {
                Notify.cancel(this, callId); toast("Saved"); finish()
            })
        }
        c.add(save, 16)
        c.add(button("Later", ACCENT, false) { finish() }, 10)

        io({ Api.loadDispositions(this) }, { arr ->
            list.removeAllViews(); dispoViews.clear()
            var r: LinearLayout? = null
            for (i in 0 until arr.length()) {
                val d = arr.getJSONObject(i)
                val dot = if (d.optBoolean("connected")) CALL else WARN
                val label = android.text.SpannableStringBuilder("●  " + d.optString("name")).apply {
                    setSpan(android.text.style.ForegroundColorSpan(dot), 0, 1, 0)
                }
                val v = text("", 15f, FG, true).apply {
                    text = label; minHeight = dp(64); gravity = android.view.Gravity.START or android.view.Gravity.CENTER_VERTICAL
                    background = rounded(SURFACE, LINE, 14); setPadding(dp(14), dp(12), dp(12), dp(12))
                    isClickable = true; setOnClickListener { pick(d) }
                }
                if (i % 2 == 0) { r = row().apply { gravity = android.view.Gravity.FILL_VERTICAL }; list.add(r!!, if (i == 0) 0 else 8) }
                r!!.add(v, if (i % 2 == 0) 0 else 8, 1f)
                dispoViews.add(d.getString("id") to v)
            }
            if (arr.length() % 2 == 1) r?.add(android.view.View(this), 8, 1f)
            if (arr.length() == 0) list.add(text("Could not load outcomes. Check your internet and reopen this screen.", 14f, DANGER))
        })
    }

    private fun needsReason(d: JSONObject) = d.optString("stage") == "lost" && d.optString("id") != "dnd" && !d.optString("name").contains("wrong", true)

    /** "Not interested" and other outcomes that close the lead: ask why (Settings → Lost reasons). */
    private fun showReasons(show: Boolean) {
        val box = lostBox ?: return
        box.visibility = if (show) android.view.View.VISIBLE else android.view.View.GONE
        if (!show) { lostReason = ""; return }
        if (box.childCount > 0) return
        val s = try { JSONObject(Prefs(this).settingsJson) } catch (e: Exception) { JSONObject() }
        val arr = s.optJSONArray("lostReasons")
        val reasons = if (arr != null && arr.length() > 0) (0 until arr.length()).map { arr.optString(it) }.filter { it.isNotBlank() }
            else listOf("Fees too high", "Not interested now", "Joined another institute", "Venue too far", "Dates or timing not suitable", "Other")
        box.add(text("Why is the lead lost?", 15f, FG, true))
        reasonViews.clear()
        reasons.forEachIndexed { i, r ->
            val v = chip(r, false) {
                lostReason = r
                for ((name, tv) in reasonViews) {
                    val sel = name == r
                    tv.setTextColor(if (sel) ACCENT else FG)
                    tv.background = if (sel) rounded(ACCENT_SOFT, ACCENT, 20) else rounded(SURFACE, LINE, 20)
                }
            }
            v.gravity = android.view.Gravity.START or android.view.Gravity.CENTER_VERTICAL
            v.setPadding(dp(16), dp(10), dp(16), dp(10))
            box.add(v, if (i == 0) 8 else 6)
            reasonViews.add(r to v)
        }
    }

    private fun pick(d: JSONObject) {
        picked = d
        showReasons(needsReason(d))
        for ((id, v) in dispoViews) {
            val sel = id == d.getString("id")
            v.setTextColor(if (sel) ACCENT else FG)
            v.background = if (sel) rounded(ACCENT_SOFT, ACCENT, 14).apply { setStroke(dp(2), ACCENT) } else rounded(SURFACE, LINE, 14)
        }
        if (d.optBoolean("fu") && followUp == 0L) setFollowUp(if (d.optBoolean("connected")) 24 else 3)
        if (!d.optBoolean("fu")) setFollowUp(0)
    }

    private fun setFollowUp(hours: Int) {
        followUp = when {
            hours == 0 -> 0
            hours >= 24 -> Calendar.getInstance().apply {
                add(Calendar.DAY_OF_YEAR, hours / 24); set(Calendar.HOUR_OF_DAY, 11); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0)
            }.timeInMillis
            else -> System.currentTimeMillis() + hours * 3_600_000L
        }
        fuLabel?.text = if (followUp == 0L) "No follow-up" else "Follow-up: " + Fmt.when_(followUp)
        fuLabel?.setTextColor(if (followUp == 0L) MUTED else ACCENT)
    }
}

/* ------------------------------------------------------------------ */
/* After a call with a number that is not in the CRM                   */
/* ------------------------------------------------------------------ */
class UnknownCallActivity : BaseActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val number = intent.getStringExtra("number") ?: run { finish(); return }
        val externalId = intent.getStringExtra("external_id") ?: run { finish(); return }
        val direction = intent.getStringExtra("direction") ?: "incoming"
        val start = intent.getLongExtra("start", 0)
        val seconds = intent.getLongExtra("seconds", 0)
        val digits = Fmt.digits(number)
        val h = header()
        h.add(headerTop("New number") { finish() })
        val what = when { direction == "missed" -> "Missed call"; seconds > 0 -> "Talked for ${Fmt.dur(seconds)}"; else -> "The call did not connect" }
        val hr = row()
        hr.addView(avatar("?", 48, WARN))
        hr.add(column(0).apply {
            setPadding(dp(12), 0, 0, 0)
            add(text(number, 21f, android.graphics.Color.WHITE, true))
            add(text("$what · ${Fmt.when_(start)}", 14f, ON_NAVY), 2)
        }, 0, 1f)
        h.add(hr, 12)
        val c = shell(h)
        c.add(text("This number is not in the CRM, so nothing about this call has been saved. Was it a customer enquiry?", 15f), 14)

        val name = input("Their name (optional)", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS)
        c.add(name, 16)
        c.add(button("Add as lead", CALL) {
            val args = JSONObject().put("p_phone", number).put("p_name", name.text.toString().trim()).put("p_direction", direction)
                .put("p_started_at", Fmt.iso(start)).put("p_duration", seconds).put("p_external_id", externalId)
            io({
                val o = JSONObject(Api.rpc(this, "add_call_lead", args))
                val callId = o.getString("call_id")
                if (seconds > 0 && Prefs(this).recordingsEnabled && !o.optBoolean("duplicate")) {
                    if (!Recordings.tryUpload(this, callId, start, seconds, digits)) Recordings.addPending(this, callId, start, seconds, digits)
                }
                o
            }, { o ->
                Prefs(this).removeUnknown(externalId, digits)
                Notify.cancelUnknown(this, externalId)
                toast("Added as a lead. Its calls are saved from now on.")
                if (direction != "missed") {
                    startActivity(Intent(this, OutcomeActivity::class.java).putExtra("call_id", o.getString("call_id"))
                        .putExtra("lead_name", o.optString("lead_name")).putExtra("lead_id", o.optString("lead_id"))
                        .putExtra("seconds", seconds).putExtra("direction", direction))
                }
                finish()
            })
        }, 12)
        c.add(button("Personal call, don't save", ACCENT, false) {
            Prefs(this).addPersonal(digits)
            Prefs(this).removeUnknown(externalId, digits)
            Notify.cancelUnknown(this, externalId)
            toast("Not saved. You won't be asked about this number again.")
            finish()
        }, 10)
        c.add(button("Decide later", MUTED, false) { finish() }, 10)
        c.add(text("Personal calls and their recordings never leave your phone.", 13f, MUTED), 14)
    }
}
