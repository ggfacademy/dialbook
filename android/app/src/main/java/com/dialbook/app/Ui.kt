package com.dialbook.app

import android.app.Activity
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** The full CRM website. */
const val WEB_URL = "https://ggfacademy.github.io/dialbook/"

/** Shared look and helpers for every screen. Views are built in code to keep the app small. */
open class BaseActivity : Activity() {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    companion object {
        val BG = Color.parseColor("#F6F4EF")
        val SURFACE = Color.WHITE
        val FG = Color.parseColor("#1B1E2B")
        val MUTED = Color.parseColor("#5E6273")
        val LINE = Color.parseColor("#E3DDD0")
        val ACCENT = Color.parseColor("#946600")
        val ACCENT_SOFT = Color.parseColor("#FBF1D9")
        val CALL = Color.parseColor("#12834A")
        val DANGER = Color.parseColor("#BD3434")
        val NAVY = Color.parseColor("#0B1F4B")
        val NAVY2 = Color.parseColor("#1C3A7A")
        val GOLD = Color.parseColor("#E3B341")
        val GOLD_HI = Color.parseColor("#F2C14E")
        val ON_NAVY = Color.parseColor("#C8D2EA")
        val CALL_SOFT = Color.parseColor("#E1F3E8")
        val WARN = Color.parseColor("#A86300")
        val AVATAR = intArrayOf(0xFF3A7BD5.toInt(), 0xFF12834A.toInt(), 0xFF946600.toInt(), 0xFF8A4FC4.toInt(),
            0xFF0E7C7B.toInt(), 0xFFBD3434.toInt(), 0xFF5B6B8C.toInt(), 0xFFB8860B.toInt())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = NAVY
    }

    override fun onDestroy() { scope.cancel(); super.onDestroy() }

    fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    /** Poppins, the same font as the website (res/font). */
    val regularFont: Typeface by lazy { try { resources.getFont(R.font.poppins_regular) } catch (e: Exception) { Typeface.DEFAULT } }
    val boldFont: Typeface by lazy { try { resources.getFont(R.font.poppins_semibold) } catch (e: Exception) { Typeface.DEFAULT_BOLD } }

    fun <T> io(work: suspend () -> T, done: (T) -> Unit, failed: (Exception) -> Unit = { toast(it.message ?: "Something went wrong") }) {
        scope.launch {
            try {
                val r = withContext(Dispatchers.IO) { work() }
                done(r)
            } catch (e: Exception) {
                if (e is ApiError && e.code == 401) { Prefs(this@BaseActivity).logout() }
                failed(e)
            }
        }
    }

    fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    fun rounded(fill: Int, stroke: Int = 0, radius: Int = 12): GradientDrawable = GradientDrawable().apply {
        setColor(fill); cornerRadius = dp(radius).toFloat(); if (stroke != 0) setStroke(dp(1), stroke)
    }

    fun column(pad: Int = 16): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setPadding(dp(pad), dp(pad), dp(pad), dp(pad))
    }

    fun row(): LinearLayout = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }

    fun text(s: String, size: Float = 15f, color: Int = FG, bold: Boolean = false): TextView = TextView(this).apply {
        text = s; textSize = size; setTextColor(color); typeface = if (bold) boldFont else regularFont
        setLineSpacing(0f, 1.15f)
    }

    fun heading(s: String) = text(s, 24f, FG, true).apply { setPadding(0, dp(4), 0, dp(8)) }

    fun button(label: String, color: Int = ACCENT, filled: Boolean = true, onClick: () -> Unit): TextView = TextView(this).apply {
        text = label; textSize = 16f; gravity = Gravity.CENTER; typeface = boldFont
        setTextColor(if (filled) Color.WHITE else color)
        background = if (filled) rounded(color, 0, 14) else rounded(SURFACE, LINE, 14)
        setPadding(dp(16), dp(13), dp(16), dp(13))
        isClickable = true; isFocusable = true
        setOnClickListener { onClick() }
    }

    fun chip(label: String, selected: Boolean, onClick: () -> Unit): TextView = TextView(this).apply {
        text = label; textSize = 14f; gravity = Gravity.CENTER
        setTextColor(if (selected) Color.WHITE else FG)
        typeface = if (selected) boldFont else regularFont
        background = if (selected) rounded(NAVY, NAVY, 20) else rounded(SURFACE, LINE, 20)
        setPadding(dp(14), dp(8), dp(14), dp(8))
        setOnClickListener { onClick() }
    }

    fun input(hint: String, type: Int = InputType.TYPE_CLASS_TEXT, lines: Int = 1): EditText = EditText(this).apply {
        this.hint = hint; inputType = type; textSize = 16f; setTextColor(FG); setHintTextColor(MUTED); typeface = regularFont
        background = rounded(SURFACE, LINE, 12); setPadding(dp(14), dp(12), dp(14), dp(12))
        if (lines > 1) { minLines = lines; gravity = Gravity.TOP or Gravity.START
            inputType = type or InputType.TYPE_TEXT_FLAG_MULTI_LINE }
    }

    fun card(): LinearLayout = column(14).apply { background = rounded(SURFACE, LINE, 16); elevation = dp(1).toFloat() }

    /** A white icon from res/drawable, tinted. */
    fun icon(res: Int, color: Int, size: Int = 22): ImageView = ImageView(this).apply {
        setImageResource(res); imageTintList = ColorStateList.valueOf(color)
        layoutParams = LinearLayout.LayoutParams(dp(size), dp(size))
    }

    /** Round badge with a person's initials, coloured from their name. */
    fun avatar(name: String, size: Int = 44, color: Int = 0): TextView = TextView(this).apply {
        val n = name.trim().ifEmpty { "?" }
        text = n.split(Regex("\\s+")).take(2).joinToString("") { it.take(1) }.uppercase()
        textSize = size / 3.2f; typeface = boldFont; gravity = Gravity.CENTER; setTextColor(Color.WHITE)
        var h = 0; for (c in n) h = h * 31 + c.code
        background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(if (color != 0) color else AVATAR[Math.floorMod(h, AVATAR.size)]) }
        layoutParams = LinearLayout.LayoutParams(dp(size), dp(size))
    }

    /** Small rounded label, e.g. a stage. */
    fun pill(label: String, fg: Int, bg: Int): TextView = text(label, 12f, fg, true).apply {
        background = rounded(bg, 0, 20); setPadding(dp(10), dp(3), dp(10), dp(3))
    }

    /** Round green Call button. */
    fun callButton(phone: String, size: Int = 48): View = FrameLayout(this).apply {
        background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(CALL) }
        elevation = dp(2).toFloat()
        addView(icon(R.drawable.ic_call, Color.WHITE, size / 2), FrameLayout.LayoutParams(dp(size / 2), dp(size / 2), Gravity.CENTER))
        layoutParams = LinearLayout.LayoutParams(dp(size), dp(size))
        isClickable = true; contentDescription = "Call"
        setOnClickListener { startCall(phone) }
    }

    /** Square action tile with an icon above its label (lead screen actions). */
    fun tile(res: Int, label: String, fg: Int, bg: Int, onClick: () -> Unit): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
        background = rounded(bg, 0, 16); setPadding(dp(6), dp(12), dp(6), dp(10)); minimumHeight = dp(80)
        addView(icon(res, fg, 24))
        addView(text(label, 12f, fg, true).apply { gravity = Gravity.CENTER; setPadding(0, dp(6), 0, 0) })
        isClickable = true; setOnClickListener { onClick() }
    }

    /** Navy header band at the top of a screen. */
    fun header(): LinearLayout = column(0).apply {
        background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(NAVY, NAVY2))
        setPadding(dp(18), dp(16), dp(18), dp(18))
    }

    /** Back arrow + title for a navy header. */
    fun headerTop(title: String, onBack: (() -> Unit)? = null): LinearLayout = row().apply {
        if (onBack != null) {
            val b = FrameLayout(this@BaseActivity).apply {
                background = rounded(Color.argb(30, 255, 255, 255), 0, 20)
                addView(icon(R.drawable.ic_back, Color.WHITE, 22), FrameLayout.LayoutParams(dp(22), dp(22), Gravity.CENTER))
                isClickable = true; contentDescription = "Back"; setOnClickListener { onBack() }
            }
            addView(b, LinearLayout.LayoutParams(dp(40), dp(40)))
        }
        addView(text(title, 15f, ON_NAVY, true).apply { setPadding(dp(if (onBack != null) 12 else 0), 0, 0, 0) },
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    }

    /** Bottom tab bar: (key, label, icon). */
    fun bottomNav(items: List<Triple<String, String, Int>>, current: String, badges: Map<String, Int> = emptyMap(), onPick: (String) -> Unit): LinearLayout = row().apply {
        setBackgroundColor(NAVY); setPadding(dp(6), dp(6), dp(6), dp(8)); elevation = dp(8).toFloat()
        for ((key, label, res) in items) {
            val on = key == current
            val cell = LinearLayout(this@BaseActivity).apply {
                orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
                setPadding(dp(4), dp(6), dp(4), dp(6))
                if (on) background = rounded(Color.argb(40, 227, 179, 65), 0, 14)
                val ic = FrameLayout(this@BaseActivity)
                ic.addView(icon(res, if (on) GOLD_HI else ON_NAVY, 24), FrameLayout.LayoutParams(dp(24), dp(24), Gravity.CENTER))
                val n = badges[key] ?: 0
                if (n > 0) ic.addView(text(if (n > 99) "99+" else n.toString(), 10f, Color.WHITE, true).apply {
                    gravity = Gravity.CENTER; background = rounded(DANGER, 0, 10); setPadding(dp(5), 0, dp(5), 0); minWidth = dp(18)
                }, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(18), Gravity.TOP or Gravity.END))
                addView(ic, LinearLayout.LayoutParams(dp(44), dp(28)))
                addView(text(label, 11f, if (on) GOLD_HI else ON_NAVY, on).apply { gravity = Gravity.CENTER })
                isClickable = true; setOnClickListener { onPick(key) }
            }
            addView(cell, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = dp(2); marginEnd = dp(2) })
        }
    }

    /** Screen with a fixed header on top, a scrolling middle and an optional fixed bar at the bottom. Returns the middle column. */
    fun shell(top: View?, bottom: View? = null): LinearLayout {
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(BG) }
        if (top != null) root.addView(top, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        val content = column(16)
        val sv = ScrollView(this).apply { setBackgroundColor(BG); isFillViewport = true; addView(content) }
        root.addView(sv, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        if (bottom != null) root.addView(bottom, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        window.navigationBarColor = if (bottom != null) NAVY else Color.WHITE
        setContentView(root)
        return content
    }

    /** Section title inside a page. */
    fun section(s: String) = text(s.uppercase(), 12f, MUTED, true).apply { letterSpacing = 0.08f; setPadding(dp(2), 0, 0, 0) }

    fun LinearLayout.add(v: View, top: Int = 0, weight: Float = 0f, width: Int = ViewGroup.LayoutParams.MATCH_PARENT): View {
        val lp = if (orientation == LinearLayout.HORIZONTAL)
            LinearLayout.LayoutParams(if (weight > 0) 0 else ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, weight)
        else LinearLayout.LayoutParams(width, ViewGroup.LayoutParams.WRAP_CONTENT)
        if (orientation == LinearLayout.HORIZONTAL) lp.marginStart = dp(top) else lp.topMargin = dp(top)
        addView(v, lp); return v
    }

    fun chipRow(): Pair<HorizontalScrollView, LinearLayout> {
        val inner = row()
        val hs = HorizontalScrollView(this).apply { isHorizontalScrollBarEnabled = false; addView(inner) }
        return hs to inner
    }

    /** Puts a scrolling page on screen and returns its content column. */
    fun page(): LinearLayout {
        val root = column(16).apply { setBackgroundColor(BG) }
        val sv = ScrollView(this).apply { setBackgroundColor(BG); isFillViewport = true; addView(root) }
        setContentView(sv)
        return root
    }

    fun startCall(phone: String) {
        val uri = Uri.parse("tel:" + Fmt.e164(phone))
        val intent = if (has(android.Manifest.permission.CALL_PHONE)) Intent(Intent.ACTION_CALL, uri) else Intent(Intent.ACTION_DIAL, uri)
        try { startActivity(intent) } catch (e: Exception) { startActivity(Intent(Intent.ACTION_DIAL, uri)) }
    }

    /** Opens the full CRM website (WhatsApp inbox with templates, follow-ups, reports…) in the browser. */
    fun openWeb(hash: String = "") {
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(WEB_URL + (if (hash.isNotEmpty()) "#$hash" else "")))) } catch (e: Exception) { toast("No browser found") }
    }

    fun openWhatsApp(phone: String, message: String = "") {
        val d = Fmt.e164(phone).filter { it.isDigit() }
        val q = if (message.isNotEmpty()) "?text=" + Uri.encode(message) else ""
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$d$q"))) } catch (e: Exception) { toast("WhatsApp is not installed") }
    }

    /** The MSME application form the candidate fills in and prints (web/forms/msme-application.html). */
    fun sendApplicationForm(name: String, phone: String, course: String = "") {
        val url = WEB_URL + "forms/msme-application.html?n=" + Uri.encode(name) + "&p=" + Uri.encode(phone) +
            (if (course.isNotEmpty()) "&k=" + Uri.encode(course) else "")
        val first = name.trim().split(" ").firstOrNull() ?: ""
        openWhatsApp(phone, "Hello $first, here is the MSME application form for the ${course.ifEmpty { "Gold Appraisal" }} course. Please fill it on your phone, tap \"Print / Save as PDF\", sign the printed form and bring it on the first day of class with your photo, Aadhaar xerox and qualification certificate xerox:\n$url")
    }
}
