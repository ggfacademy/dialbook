package com.dialbook.app

import android.app.Activity
import android.content.Intent
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

/** Shared look and helpers for every screen. Views are built in code to keep the app small. */
open class BaseActivity : Activity() {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    companion object {
        val BG = Color.parseColor("#F2F4F3")
        val SURFACE = Color.WHITE
        val FG = Color.parseColor("#17201C")
        val MUTED = Color.parseColor("#5A6862")
        val LINE = Color.parseColor("#D9E0DC")
        val ACCENT = Color.parseColor("#3347D1")
        val ACCENT_SOFT = Color.parseColor("#E6E9FB")
        val CALL = Color.parseColor("#12834A")
        val DANGER = Color.parseColor("#BD3434")
        val NAVY = Color.parseColor("#141A2C")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = NAVY
    }

    override fun onDestroy() { scope.cancel(); super.onDestroy() }

    fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

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

    fun rounded(fill: Int, stroke: Int = 0, radius: Int = 10): GradientDrawable = GradientDrawable().apply {
        setColor(fill); cornerRadius = dp(radius).toFloat(); if (stroke != 0) setStroke(dp(1), stroke)
    }

    fun column(pad: Int = 16): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setPadding(dp(pad), dp(pad), dp(pad), dp(pad))
    }

    fun row(): LinearLayout = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }

    fun text(s: String, size: Float = 15f, color: Int = FG, bold: Boolean = false): TextView = TextView(this).apply {
        text = s; textSize = size; setTextColor(color); if (bold) typeface = Typeface.DEFAULT_BOLD
        setLineSpacing(0f, 1.15f)
    }

    fun heading(s: String) = text(s, 24f, FG, true).apply { setPadding(0, dp(4), 0, dp(8)) }

    fun button(label: String, color: Int = ACCENT, filled: Boolean = true, onClick: () -> Unit): TextView = TextView(this).apply {
        text = label; textSize = 16f; gravity = Gravity.CENTER; typeface = Typeface.DEFAULT_BOLD
        setTextColor(if (filled) Color.WHITE else color)
        background = if (filled) rounded(color) else rounded(SURFACE, LINE)
        setPadding(dp(16), dp(12), dp(16), dp(12))
        isClickable = true; isFocusable = true
        setOnClickListener { onClick() }
    }

    fun chip(label: String, selected: Boolean, onClick: () -> Unit): TextView = TextView(this).apply {
        text = label; textSize = 14f; gravity = Gravity.CENTER
        setTextColor(if (selected) ACCENT else FG)
        background = if (selected) rounded(ACCENT_SOFT, ACCENT, 20) else rounded(SURFACE, LINE, 20)
        setPadding(dp(14), dp(8), dp(14), dp(8))
        setOnClickListener { onClick() }
    }

    fun input(hint: String, type: Int = InputType.TYPE_CLASS_TEXT, lines: Int = 1): EditText = EditText(this).apply {
        this.hint = hint; inputType = type; textSize = 16f; setTextColor(FG); setHintTextColor(MUTED)
        background = rounded(SURFACE, LINE, 8); setPadding(dp(12), dp(10), dp(12), dp(10))
        if (lines > 1) { minLines = lines; gravity = Gravity.TOP or Gravity.START
            inputType = type or InputType.TYPE_TEXT_FLAG_MULTI_LINE }
    }

    fun card(): LinearLayout = column(14).apply { background = rounded(SURFACE, LINE) }

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

    fun openWhatsApp(phone: String) {
        val d = Fmt.e164(phone).filter { it.isDigit() }
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$d"))) } catch (e: Exception) { toast("WhatsApp is not installed") }
    }
}
