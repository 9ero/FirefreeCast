package dev.firecast.receiver

import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import org.json.JSONObject
import java.net.InetSocketAddress

class SignalingServer(port: Int, private val receiver: WebRTCReceiver) :
    WebSocketServer(InetSocketAddress(port)) {

    private var client: WebSocket? = null

    init {
        receiver.onAnswerReady = { sdp ->
            client?.send(JSONObject().apply {
                put("type", "answer")
                put("sdp", sdp)
            }.toString())
        }

        receiver.onIceCandidate = { candidate ->
            client?.send(JSONObject().apply {
                put("type",          "candidate")
                put("sdpMid",        candidate.sdpMid)
                put("sdpMLineIndex", candidate.sdpMLineIndex)
                put("candidate",     candidate.sdp)
            }.toString())
        }
    }

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
        client = conn
    }

    override fun onClose(conn: WebSocket, code: Int, reason: String, remote: Boolean) {
        if (conn == client) client = null
    }

    override fun onMessage(conn: WebSocket, message: String) {
        runCatching {
            val json = JSONObject(message)
            when (json.getString("type")) {
                "offer"     -> receiver.handleOffer(json.getString("sdp"))
                "candidate" -> receiver.addIceCandidate(
                    json.getString("sdpMid"),
                    json.getInt("sdpMLineIndex"),
                    json.getString("candidate"),
                )
            }
        }
    }

    override fun onError(conn: WebSocket?, ex: Exception) = ex.printStackTrace()
    override fun onStart() = Unit
}
