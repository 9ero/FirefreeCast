package dev.firecast.receiver

import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import org.webrtc.SurfaceViewRenderer

class MainActivity : AppCompatActivity() {

    private lateinit var renderer:       SurfaceViewRenderer
    private lateinit var statusText:     TextView
    private lateinit var webRTCReceiver: WebRTCReceiver
    private lateinit var signalingServer: SignalingServer

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)

        renderer   = findViewById(R.id.surface_renderer)
        statusText = findViewById(R.id.status_text)

        webRTCReceiver  = WebRTCReceiver(this, renderer)
        signalingServer = SignalingServer(PORT, webRTCReceiver)

        webRTCReceiver.onVideoStarted = {
            runOnUiThread { statusText.visibility = View.GONE }
        }
        webRTCReceiver.onDisconnected = {
            runOnUiThread { statusText.visibility = View.VISIBLE }
        }

        webRTCReceiver.init()
        signalingServer.start()
    }

    override fun onDestroy() {
        super.onDestroy()
        signalingServer.stop()
        webRTCReceiver.dispose()
    }

    companion object {
        const val PORT = 8765
    }
}
