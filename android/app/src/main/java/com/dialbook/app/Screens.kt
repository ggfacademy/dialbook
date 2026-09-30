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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        leadId = intent.getStringExtra("lead_id") ?: run { finish(); return }
    }

    override fun onResume() {
        super.onResume()
        if (::leadId.isInitialized) load()
    }

    private fun load() {
        val c = page()
        c.add(button("‹ Back", ACCENT, false) { finish() }.apply { textSize = 14f })
        val box = column(0); c.add(box, 12)
        box.add(text("Loading…", 14f, MUTED))
        io({
            val l = JSONArray(Api.get(this, "/rest/v1/leads?select=*&id=eq.$leadId"))
            val calls = JSONArray(Api.get(this, "/rest/v1/calls?select=*&lead_id=eq.$leadId&order=started_at.desc&limit=20"))
            val dispos = Api.loadDispositions(this)
            Triple(l, calls, dispos)
        }, { (arr, calls, dispos) ->
            box.removeAllViews()
            if (arr.length() == 0) { box.add(text("This lead is not assigned to you any more.", 15f, MUTED)); return@io }
            val l = arr.getJSONObject(0)
            val name = l.optString("name").ifEmpty { "Unnamed" }
            val phone = l.optString("phone")
            box.add(heading(name))
            box.add(text(phone, 20f, FG), 0)
            box.add(text(l.optString("stage").replace('_', ' ').replaceFirstChar { it.uppercase() } +
                (if (l.optString("city").isNotEmpty()) " · " + l.optString("city") else ""), 14f, MUTED), 4)
            val btns = row()
            btns.add(button("Call", CALL) { startCall(phone) }, 0, 1f)
            btns.add(button("WhatsApp", ACCENT, false) { openWhatsApp(phone) }, 8, 1f)
            box.add(btns, 14)
            val fu = Fmt.parse(l.optString("next_follow_up_at"))
            if (fu > 0) box.add(text("Next follow-up: " + Fmt.when_(fu), 15f, if (fu < System.currentTimeMillis()) DANGER else ACCENT, true), 14)
            if (l.optString("note").isNotEmpty()) {
                val k = card(); k.add(text("Notes", 13f, MUTED, true)); k.add(text(l.optString("note"), 15f), 4); box.add(k, 12)
            }
            box.add(text("Recent calls", 17f, FG, true), 18)
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val callId = intent.getStringExtra("call_id") ?: run { finish(); return }
        val leadName = intent.getStringExtra("lead_name") ?: "Lead"
        val seconds = intent.getLongExtra("seconds", 0)
        val c = page()
        c.add(heading("How did the call go?"), 8)
        c.add(text(leadName, 18f, FG, true))
        c.add(text(if (seconds > 0) "Talked for ${Fmt.dur(seconds)}" else "The call did not connect", 14f, MUTED), 2)

        val list = column(0); c.add(list, 14)
        list.add(text("Loading outcomes…", 14f, MUTED))

        c.add(text("Next follow-up", 15f, FG, true), 18)
        val (hs, chips) = chipRow()
        val options = listOf("1 hr" to 1, "3 hrs" to 3, "Tomorrow 11 AM" to 24, "2 days" to 48, "1 week" to 168, "None" to 0)
        options.forEachIndexed { i, (label, h) -> chips.add(chip(label, false) { setFollowUp(h) }, if (i == 0) 0 else 8) }
        c.add(hs, 8)
        fuLabel = text("No follow-up", 14f, MUTED); c.add(fuLabel!!, 6)

        val notes = input("Notes: what did they say?", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES, 3)
        c.add(notes, 16)
        val save = button("Save outcome") {
            val d = picked ?: run { toast("Pick an outcome first"); return@button }
            val args = JSONObject().put("p_call", callId).put("p_outcome", d.getString("id")).put("p_note", notes.text.toString().trim())
                .put("p_follow_up", if (followUp > 0) Fmt.iso(followUp) else JSONObject.NULL)
            io({ Api.rpc(this, "set_call_outcome", args) }, {
                Notify.cancel(this, callId); toast("Saved"); finish()
            })
        }
        c.add(save, 16)
        c.add(button("Later", ACCENT, false) { finish() }, 10)

        io({ Api.loadDispositions(this) }, { arr ->
            list.removeAllViews(); dispoViews.clear()
            for (i in 0 until arr.length()) {
                val d = arr.getJSONObject(i)
                val v = chip(d.optString("name"), false) { pick(d) }
                v.gravity = android.view.Gravity.START or android.view.Gravity.CENTER_VERTICAL
                v.textSize = 16f
                v.setPadding(dp(16), dp(12), dp(16), dp(12))
                list.add(v, if (i == 0) 0 else 8)
                dispoViews.add(d.getString("id") to v)
            }
            if (arr.length() == 0) list.add(text("Could not load outcomes. Check your internet and reopen this screen.", 14f, DANGER))
        })
    }

    private fun pick(d: JSONObject) {
        picked = d
        for ((id, v) in dispoViews) {
            val sel = id == d.getString("id")
            v.setTextColor(if (sel) ACCENT else FG)
            v.background = if (sel) rounded(ACCENT_SOFT, ACCENT, 20) else rounded(SURFACE, LINE, 20)
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
