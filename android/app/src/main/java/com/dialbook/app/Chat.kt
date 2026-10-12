package com.dialbook.app

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject

/* ------------------------------------------------------------------ */
/* Team chat: "team" (everyone) and private chats "dm:<id>:<id>"       */
/* (supabase/team-chat.sql)                                            */
/* ------------------------------------------------------------------ */
object TeamChat {
    fun dm(me: String, other: String) = "dm:" + listOf(me, other).sorted().joinToString(":")
    fun other(channel: String, me: String) = channel.split(":").drop(1).firstOrNull { it != me } ?: ""

    /** Active colleagues: id → name. */
    fun people(ctx: Context): Map<String, String> {
        val arr = JSONArray(Api.get(ctx, "/rest/v1/profiles?select=id,name,role&active=eq.true&order=name.asc"))
        return (0 until arr.length()).associate { arr.getJSONObject(it).let { o -> o.optString("id") to o.optString("name") } }
    }

    fun title(channel: String, me: String, names: Map<String, String>) =
        if (channel == "team") "Everyone" else names[other(channel, me)] ?: "Colleague"

    fun send(ctx: Context, channel: String, body: String, leadId: String? = null) {
        val o = JSONObject().put("channel", channel).put("sender_id", Prefs(ctx).userId).put("body", body)
        if (leadId != null) o.put("lead_id", leadId)
        Api.post(ctx, "/rest/v1/team_messages", o.toString())
    }

    /** Background check (every sync): a notification for new messages from colleagues. */
    fun notifyNew(ctx: Context) {
        val p = Prefs(ctx)
        val inbox = try { JSONArray(Api.rpc(ctx, "team_inbox", JSONObject())) } catch (e: Exception) { return }
        var newest = p.chatNotified
        var names: Map<String, String>? = null
        for (i in 0 until inbox.length()) {
            val o = inbox.getJSONObject(i)
            val at = Fmt.parse(o.optString("last_at"))
            if (o.optInt("unread") <= 0 || at <= p.chatNotified || o.optString("last_sender") == p.userId) continue
            val nm = names ?: (try { people(ctx) } catch (e: Exception) { emptyMap() }).also { names = it }
            val ch = o.optString("channel")
            val from = nm[o.optString("last_sender")] ?: "A colleague"
            val i2 = Intent(ctx, ChatActivity::class.java).putExtra("channel", ch).putExtra("title", title(ch, p.userId, nm))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            val pi = PendingIntent.getActivity(ctx, ch.hashCode(), i2, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val n = NotificationCompat.Builder(ctx, App.CHAT)
                .setSmallIcon(android.R.drawable.sym_action_chat)
                .setContentTitle(if (ch == "team") "$from · Team chat" else from)
                .setContentText(o.optString("last_body").ifEmpty { "Shared a lead" })
                .setStyle(NotificationCompat.BigTextStyle().bigText(o.optString("last_body")))
                .setNumber(o.optInt("unread"))
                .setAutoCancel(true).setContentIntent(pi).build()
            try { NotificationManagerCompat.from(ctx).notify(ch.hashCode(), n) } catch (e: SecurityException) { }
            if (at > newest) newest = at
        }
        p.chatNotified = newest
    }
}

/** One conversation. New messages appear every few seconds while it is open. */
class ChatActivity : BaseActivity() {
    private lateinit var channel: String
    private lateinit var list: LinearLayout
    private lateinit var scroll: ScrollView
    private var names: Map<String, String> = emptyMap()
    private var lastId = ""
    private val handler = Handler(Looper.getMainLooper())
    private val poll = object : Runnable { override fun run() { load(); handler.postDelayed(this, 4000) } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        channel = intent.getStringExtra("channel") ?: run { finish(); return }
        val title = intent.getStringExtra("title") ?: "Team chat"
        val share = intent.getStringExtra("share_lead")

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(BG) }
        val h = header()
        h.add(headerTop(title) { finish() })
        h.add(text(if (channel == "team") "Everyone in the team sees these messages" else "Private chat", 13f, ON_NAVY), 4)
        root.addView(h)
        list = column(12)
        scroll = ScrollView(this).apply { setBackgroundColor(BG); isFillViewport = true; addView(list) }
        root.addView(scroll, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        val bar = row().apply { setBackgroundColor(SURFACE); setPadding(dp(10), dp(8), dp(10), dp(10)); elevation = dp(6).toFloat() }
        val box = input("Type a message", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or InputType.TYPE_TEXT_FLAG_MULTI_LINE).apply { maxLines = 5 }
        if (share != null) box.setText(intent.getStringExtra("share_text") ?: "")
        bar.add(box, 0, 1f)
        val send = FrameLayout(this).apply {
            background = android.graphics.drawable.GradientDrawable().apply { shape = android.graphics.drawable.GradientDrawable.OVAL; setColor(ACCENT) }
            addView(icon(R.drawable.ic_send, Color.WHITE, 22), FrameLayout.LayoutParams(dp(22), dp(22), Gravity.CENTER))
            contentDescription = "Send"; isClickable = true
        }
        bar.addView(send, LinearLayout.LayoutParams(dp(48), dp(48)).apply { marginStart = dp(8) })
        root.addView(bar)
        window.navigationBarColor = Color.WHITE
        setContentView(root)

        var shareId = share
        send.setOnClickListener {
            val t = box.text.toString().trim()
            if (t.isEmpty() && shareId == null) return@setOnClickListener
            send.isEnabled = false
            io({ TeamChat.send(this, channel, t, shareId) }, {
                box.setText(""); shareId = null; send.isEnabled = true; load()
            }, { e -> send.isEnabled = true; toast(if (e is ApiError && e.code == 404) "Ask your admin to run supabase/team-chat.sql" else (e.message ?: "Not sent")) })
        }
        io({ TeamChat.people(this) }, { names = it; lastId = ""; load() }, { load() })
    }

    override fun onResume() { super.onResume(); if (::channel.isInitialized) handler.post(poll) }
    override fun onPause() { handler.removeCallbacks(poll); super.onPause() }

    private fun load() {
        val me = Prefs(this).userId
        io({
            val arr = JSONArray(Api.get(this, "/rest/v1/team_messages?select=*,lead:leads(id,name,phone)&channel=eq.${android.net.Uri.encode(channel)}&order=created_at.desc&limit=200"))
            if (arr.length() > 0 && arr.getJSONObject(0).optString("id") != lastId)
                try { Api.rpc(this, "team_mark_read", JSONObject().put("p_channel", channel)) } catch (e: Exception) { }
            arr
        }, { arr ->
            val top = if (arr.length() > 0) arr.getJSONObject(0).optString("id") else "-"
            if (top == lastId) return@io
            lastId = top
            list.removeAllViews()
            if (arr.length() == 0) {
                list.add(text(if (channel == "team") "No messages yet. Say hello to the team." else "No messages yet.", 15f, MUTED).apply { gravity = Gravity.CENTER }, 30)
                return@io
            }
            var lastDay = ""
            for (i in arr.length() - 1 downTo 0) {
                val m = arr.getJSONObject(i)
                val mine = m.optString("sender_id") == me
                val at = Fmt.parse(m.optString("created_at"))
                val day = java.text.SimpleDateFormat("EEE, d MMM", java.util.Locale("en", "IN")).format(java.util.Date(at))
                if (day != lastDay) { list.add(text(day, 12f, MUTED, true).apply { gravity = Gravity.CENTER }, 10); lastDay = day }
                val wrap = row().apply { gravity = if (mine) Gravity.END else Gravity.START }
                val b = column(0).apply {
                    background = rounded(if (mine) CALL_SOFT else SURFACE, if (mine) 0 else LINE, 16)
                    setPadding(dp(12), dp(8), dp(12), dp(8))
                }
                if (!mine && channel == "team") b.add(text(names[m.optString("sender_id")] ?: "Colleague", 12f, ACCENT, true))
                val body = m.optString("body")
                if (body.isNotEmpty()) b.add(text(body, 15f, FG), 2)
                val lead = m.optJSONObject("lead")
                if (lead != null) {
                    val lid = lead.optString("id")
                    b.add(chip("👤 " + lead.optString("name").ifEmpty { lead.optString("phone") }, false) {
                        startActivity(Intent(this, LeadActivity::class.java).putExtra("lead_id", lid))
                    }, 6)
                }
                b.add(text(java.text.SimpleDateFormat("h:mm a", java.util.Locale("en", "IN")).format(java.util.Date(at)), 11f, MUTED).apply { gravity = Gravity.END }, 2)
                wrap.addView(b, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    if (mine) marginStart = dp(48) else marginEnd = dp(48)
                })
                list.add(wrap, 6)
            }
            scroll.post { scroll.fullScroll(ScrollView.FOCUS_DOWN) }
        }, { e -> if (lastId.isEmpty()) { list.removeAllViews(); list.add(text(if (e is ApiError && e.code == 404) "Team chat is not switched on yet. Ask your admin to run supabase/team-chat.sql." else (e.message ?: "Could not load messages"), 15f, DANGER)) } })
    }
}

/** Pick a conversation to share a lead in. */
fun BaseActivity.shareLeadInChat(leadId: String, leadName: String) {
    val me = Prefs(this).userId
    io({ TeamChat.people(this) }, { names ->
        val others = names.filterKeys { it != me }.toList()
        val labels = (listOf("Everyone (team)") + others.map { it.second }).toTypedArray()
        android.app.AlertDialog.Builder(this).setTitle("Share $leadName with").setItems(labels) { _, which ->
            val ch = if (which == 0) "team" else TeamChat.dm(me, others[which - 1].first)
            startActivity(Intent(this, ChatActivity::class.java).putExtra("channel", ch)
                .putExtra("title", if (which == 0) "Everyone" else others[which - 1].second)
                .putExtra("share_lead", leadId).putExtra("share_text", "Please look at this lead: $leadName"))
        }.setNegativeButton("Cancel", null).show()
    })
}
