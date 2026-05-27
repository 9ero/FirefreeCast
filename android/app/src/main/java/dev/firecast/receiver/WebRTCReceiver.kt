package dev.firecast.receiver

import android.content.Context
import android.os.Handler
import android.os.Looper
import org.webrtc.*

class WebRTCReceiver(
    private val context: Context,
    private val renderer: SurfaceViewRenderer,
) {
    private lateinit var factory:        PeerConnectionFactory
    private lateinit var eglBase:        EglBase
    private var peerConnection:          PeerConnection? = null
    private val mainHandler =            Handler(Looper.getMainLooper())

    var onAnswerReady:  ((String) -> Unit)? = null
    var onIceCandidate: ((IceCandidate) -> Unit)? = null
    var onVideoStarted: (() -> Unit)? = null
    var onDisconnected: (() -> Unit)? = null

    fun init() {
        eglBase = EglBase.create()

        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context)
                .createInitializationOptions()
        )

        factory = PeerConnectionFactory.builder()
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true))
            .createPeerConnectionFactory()

        renderer.init(eglBase.eglBaseContext, null)
        renderer.setMirror(false)
    }

    fun handleOffer(sdpString: String) {
        val config = PeerConnection.RTCConfiguration(emptyList())

        peerConnection = factory.createPeerConnection(config, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate) {
                onIceCandidate?.invoke(candidate)
            }

            override fun onTrack(transceiver: RtpTransceiver) {
                when (val track = transceiver.receiver.track()) {
                    is VideoTrack -> {
                        track.addSink(renderer)
                        mainHandler.post { onVideoStarted?.invoke() }
                    }
                    else -> Unit
                }
            }

            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
                if (state == PeerConnection.IceConnectionState.DISCONNECTED ||
                    state == PeerConnection.IceConnectionState.FAILED) {
                    mainHandler.post { onDisconnected?.invoke() }
                }
            }

            // Required no-op overrides
            override fun onSignalingChange(state: PeerConnection.SignalingState)          = Unit
            override fun onIceConnectionReceivingChange(receiving: Boolean)               = Unit
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState)    = Unit
            override fun onIceCandidatesRemoved(candidates: Array<IceCandidate>)          = Unit
            override fun onAddStream(stream: MediaStream)                                 = Unit
            override fun onRemoveStream(stream: MediaStream)                              = Unit
            override fun onDataChannel(channel: DataChannel)                              = Unit
            override fun onRenegotiationNeeded()                                          = Unit
        }) ?: return

        val offer = SessionDescription(SessionDescription.Type.OFFER, sdpString)
        peerConnection!!.setRemoteDescription(SimpleSdpObserver(), offer)

        peerConnection!!.createAnswer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(sdp: SessionDescription) {
                peerConnection!!.setLocalDescription(SimpleSdpObserver(), sdp)
                onAnswerReady?.invoke(sdp.description)
            }
        }, MediaConstraints())
    }

    fun addIceCandidate(sdpMid: String, sdpMLineIndex: Int, candidate: String) {
        peerConnection?.addIceCandidate(IceCandidate(sdpMid, sdpMLineIndex, candidate))
    }

    fun dispose() {
        peerConnection?.dispose()
        factory.dispose()
        renderer.release()
        eglBase.release()
    }
}

open class SimpleSdpObserver : SdpObserver {
    override fun onCreateSuccess(sdp: SessionDescription) = Unit
    override fun onSetSuccess()                            = Unit
    override fun onCreateFailure(error: String)            = Unit
    override fun onSetFailure(error: String)               = Unit
}
