package com.dialbook.app

import android.Manifest
import android.app.Activity
import android.app.Application
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import androidx.work.testing.WorkManagerTestInitHelper
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.io.FileOutputStream

class PreviewApp : Application() {
    override fun onCreate() { super.onCreate(); WorkManagerTestInitHelper.initializeTestWorkManager(this) }
}

/** Renders the main screens with sample data as PNG files in build/previews, so the design can be checked without a phone. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], application = PreviewApp::class, qualifiers = "w393dp-h852dp-xxhdpi")
class PreviewTest {
    private val server = MockWebServer()
    private val out = File(System.getProperty("user.dir") ?: ".", "build/previews").apply { mkdirs() }
    private val now = System.currentTimeMillis()
    private fun at(h: Double) = Fmt.iso(now + (h * 3_600_000).toLong())

    private val leads = """[
      {"id":"l1","name":"Karthik Raja","phone":"+91 97890 44556","city":"Tambaram","stage":"interested","priority":"hot","call_count":2,"next_follow_up_at":"${at(-2.0)}","language":"Tamil","campaign_id":"c1","note":"Wants the weekend batch. Will confirm after talking to family."},
      {"id":"l2","name":"Madhavan R","phone":"+91 98401 23456","city":"Chennai","stage":"new","priority":"","call_count":0,"next_follow_up_at":null},
      {"id":"l3","name":"Lakshmi Narayanan","phone":"+91 99620 77889","city":"Chennai","stage":"followup","priority":"warm","call_count":1,"next_follow_up_at":"${at(3.0)}"},
      {"id":"l4","name":"Sravani K","phone":"+91 98100 12345","city":"Vijayawada","stage":"contacted","priority":"","call_count":1,"next_follow_up_at":"${at(26.0)}"},
      {"id":"l5","name":"Deepa S","phone":"+91 98405 15675","city":"Chennai","stage":"new","priority":"hot","call_count":0,"next_follow_up_at":null}]"""
    private val dispos = """[{"id":"interested","name":"Interested","connected":true,"stage":"interested","fu":true},{"id":"callback","name":"Call back later","connected":true,"stage":"followup","fu":true},
      {"id":"info_shared","name":"Details shared","connected":true,"stage":"contacted","fu":true},{"id":"converted","name":"Converted / Sale","connected":true,"stage":"won","fu":false},
      {"id":"not_interested","name":"Not interested","connected":true,"stage":"lost","fu":false},{"id":"no_answer","name":"Did not pick","connected":false,"stage":"","fu":true},
      {"id":"busy","name":"Busy / Cut the call","connected":false,"stage":"","fu":true},{"id":"unreachable","name":"Switched off","connected":false,"stage":"","fu":true}]"""

    @Before fun setUp() {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path ?: ""
                val body = when {
                    path.startsWith("/rest/v1/profiles") -> """[{"id":"u1","name":"Priya Dharshini","active":true,"role":"telecaller","languages":["Tamil"]}]"""
                    path.startsWith("/rest/v1/rpc/today_progress") -> """[{"agent":"u1","name":"Priya","calls":37,"connected":15,"converted":1,"talk":1800,"due":4,"target":{"calls":60,"connected":20,"converted":1}}]"""
                    path.startsWith("/rest/v1/rpc/calls_to_log") -> """[{"id":"k1","started_at":"${at(-0.3)}","duration":184,"direction":"outgoing","lead_id":"l1","lead_name":"Karthik Raja","lead_phone":"+91 97890 44556"},
                        {"id":"k2","started_at":"${at(-1.2)}","duration":0,"direction":"outgoing","lead_id":"l2","lead_name":"Madhavan R","lead_phone":"+91 98401 23456"}]"""
                    path.startsWith("/rest/v1/settings") -> """[{"data":{"company":"Global Gold Foundation","dispositions":$dispos,
                        "scripts":[{"name":"GAC Tamil","language":"Tamil","body":"Vanakkam {first_name}, I am {agent} from {company}..."}]}}]"""
                    path.startsWith("/rest/v1/leads") && path.contains("id=eq.") -> "[" + leads.substringAfter("[").substringBefore("},") + "}]"
                    path.startsWith("/rest/v1/leads") && path.contains("next_follow_up_at=lt") -> leads.replace(Regex(""",\s*\{"id":"l[245]"[^}]*\}"""), "")
                    path.startsWith("/rest/v1/leads") -> leads
                    path.startsWith("/rest/v1/calls") -> """[{"id":"k9","outcome":"callback","started_at":"${at(-24.0)}","duration":245,"source":"phone","note":"Asked for weekend timings","recording_path":"x"}]"""
                    path.startsWith("/rest/v1/campaigns") -> """[{"name":"Gold Appraisal – Chennai","script":""}]"""
                    else -> "[]"
                }
                return MockResponse().setHeader("Content-Type", "application/json").setBody(body)
            }
        }
        server.start()
        val app = ApplicationProvider.getApplicationContext<Application>()
        shadowOf(app).grantPermissions(Manifest.permission.READ_CALL_LOG, Manifest.permission.READ_PHONE_STATE, Manifest.permission.CALL_PHONE,
            Manifest.permission.POST_NOTIFICATIONS, Manifest.permission.READ_MEDIA_AUDIO)
        val p = Prefs(app)
        p.url = server.url("/").toString().trimEnd('/'); p.anonKey = "anon-key-for-preview-only-000000"
        p.access = "token"; p.refresh = "refresh"; p.expiresAt = now + 3_600_000; p.userId = "u1"; p.name = "Priya Dharshini"
        p.unknownCalls = """[{"number":"+91 90031 22334","direction":"incoming","start":${now - 1_800_000},"seconds":95,"external_id":"x1"}]"""
        app.getSharedPreferences("dialbook", 0).edit().putBoolean("permsDone", true).apply()
    }

    @After fun tearDown() { server.shutdown() }

    private fun settle() { repeat(30) { Thread.sleep(60); shadowOf(Looper.getMainLooper()).idle() } }

    private fun shot(a: Activity, name: String) {
        settle()
        val v = a.window.decorView
        val w = 1179; val h = 2556
        v.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY))
        v.layout(0, 0, w, h)
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        v.draw(Canvas(bmp))
        FileOutputStream(File(out, "$name.png")).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun clickText(root: View, label: String): Boolean {
        if (root is TextView && root.text.toString() == label) {
            var x: View? = root
            while (x != null && !x.hasOnClickListeners()) x = x.parent as? View
            x?.performClick(); return x != null
        }
        if (root is ViewGroup) for (i in 0 until root.childCount) if (clickText(root.getChildAt(i), label)) return true
        return false
    }

    @Test fun screens() {
        val main = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        shot(main, "1-my-leads")
        clickText(main.window.decorView, "Follow-ups"); shot(main, "2-follow-ups")
        clickText(main.window.decorView, "To log"); shot(main, "3-to-log")
        val app = ApplicationProvider.getApplicationContext<Application>()
        val lead = Robolectric.buildActivity(LeadActivity::class.java, Intent(app, LeadActivity::class.java).putExtra("lead_id", "l1")).setup().get()
        shot(lead, "4-lead")
        val oc = Robolectric.buildActivity(OutcomeActivity::class.java, Intent(app, OutcomeActivity::class.java)
            .putExtra("call_id", "k1").putExtra("lead_name", "Karthik Raja").putExtra("lead_id", "l1").putExtra("seconds", 184L)).setup().get()
        settle(); clickText(oc.window.decorView, "●  Interested"); shot(oc, "5-call-outcome")
        val un = Robolectric.buildActivity(UnknownCallActivity::class.java, Intent(app, UnknownCallActivity::class.java)
            .putExtra("number", "+91 90031 22334").putExtra("external_id", "x1").putExtra("direction", "incoming").putExtra("start", now - 1_800_000).putExtra("seconds", 95L)).setup().get()
        shot(un, "6-new-number")
    }
}
