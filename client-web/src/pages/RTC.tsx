/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import chalk from 'chalk'

const hostname = window.location.hostname

const peerConnectionOptions = {
	iceServers: [
		{
			urls: 'stun:114.55.245.37',
			// urls: 'stun:stun.voipstunt.com',

			credential: 'jdhegfl',
			username: 'test',
		},
		{
			urls: 'turn:114.55.245.37',
			credential: 'jdhegfl',
			username: 'test',
		},
	],
}

function Page() {
	const searchParams = new URLSearchParams(window.location.search)
	const id = searchParams.get('id')
	const targetID = searchParams.get('targetID')
	const role = searchParams.get('role')

	const [ws, setWs] = useState<WebSocket | null>(null)

	// 建立 ws 链接

	useEffect(() => {
		console.log(chalk.greenBright.bold.bgBlack('Initing App...'))

		if (!id) {
			console.error(chalk.red('Missing id in query params'))
			return
		}

		if (!targetID) {
			console.error(chalk.red('Missing targetID in query params'))
			return
		}

		const url = `ws://${hostname}?id=${id}`

		const ws = new WebSocket(url)
		// ws.binaryType = 'blob'

		ws.onopen = () => {
			console.log(chalk.greenBright.bold.bgBlack('Connected to server'))

			setWs(ws)

			ws.send(
				JSON.stringify({
					type: 'greeting',
					data: 'hello!',
					targetID,
				}),
			)
		}

		ws.onmessage = (event) => {
			const msg = event.data
			console.log(chalk.magenta('Received message:'), msg)
		}

		return () => {
			console.log(chalk.redBright.bold.bgBlack('Closing connection...'))
			ws.close()
			setWs(null)
		}
	}, [id, targetID])

	// 建立 rtc 链接

	const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null)

	const videoElemRef = useRef<HTMLVideoElement>(null!)

	// 发送侧
	useEffect(() => {
		if (!ws) return
		if (!targetID) {
			console.error(chalk.red('Missing targetID in query params'))
			return
		}

		if (role !== 'sender') return

		const videoElem = videoElemRef.current

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const stream = (videoElem as any).captureStream() as MediaStream

		const peerConnection = new RTCPeerConnection(peerConnectionOptions)

		const dataChannel = peerConnection.createDataChannel(
			'control channel',
			{
				ordered: true,
			},
		)
		dataChannel.onopen = () => {
			console.log(chalk.green('Data channel opened'))
			setDataChannel(dataChannel)
		}

		stream.getTracks().forEach((track) => {
			peerConnection.addTrack(track, stream)
		})

		peerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				console.log(
					chalk.yellow('Sending ICE candidate...'),
					// event.candidate,
				)
				ws.send(
					JSON.stringify({
						type: 'ice-candidate',
						data: event.candidate,
						targetID,
					}),
				)
			}
		}

		peerConnection.createOffer().then((offer) => {
			peerConnection.setLocalDescription(offer)
			ws.send(
				JSON.stringify({
					type: 'offer',
					data: offer,
					targetID,
				}),
			)
		})

		ws.onmessage = (event) => {
			const msg = JSON.parse(event.data)
			console.log(chalk.magenta('Received message:'), msg)

			if (msg.type === 'answer') {
				console.log(chalk.green('Received answer'))
				peerConnection.setRemoteDescription(
					new RTCSessionDescription(msg.data),
				)
			}

			if (msg.type === 'ice-candidate') {
				console.log(chalk.yellow('Received ICE candidate'))
				peerConnection.addIceCandidate(new RTCIceCandidate(msg.data))
			}
		}

		return () => {
			console.log(chalk.redBright.bold.bgBlack('Closing connection...'))
			peerConnection.close()
		}
	}, [ws, id, targetID, role])

	// 接受侧
	useEffect(() => {
		if (!ws) return
		if (role !== 'receiver') return
		;(globalThis as any)['ws'] = ws

		const videoElem = videoElemRef.current

		const peerConnection = new RTCPeerConnection(peerConnectionOptions)

		peerConnection.ondatachannel = (event) => {
			const dataChannel = event.channel
			console.log(chalk.green('Data channel opened'))
			setDataChannel(dataChannel)
			;(globalThis as any)['dataChannel'] = dataChannel
		}

		peerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				console.log(
					chalk.yellow('Sending ICE candidate...'),
					// event.candidate,
				)
				ws.send(
					JSON.stringify({
						type: 'ice-candidate',
						data: event.candidate,
						targetID,
					}),
				)
			}
		}

		peerConnection.ontrack = (event) => {
			console.log(chalk.green('Received remote stream'))

			videoElem.oncanplay = () => {
				console.log(chalk.green('Video can play'))
				// videoElem.play()
			}

			videoElem.srcObject = event.streams[0]
		}

		ws.onmessage = (event) => {
			const msg = JSON.parse(event.data)
			console.log(chalk.magenta('Received message:'), msg)

			if (msg.type === 'offer') {
				console.log(chalk.green('Received offer'))
				peerConnection.setRemoteDescription(
					new RTCSessionDescription(msg.data),
				)
				peerConnection.createAnswer().then((answer) => {
					peerConnection.setLocalDescription(answer)
					ws.send(
						JSON.stringify({
							type: 'answer',
							data: answer,
							targetID,
						}),
					)
				})
			}

			if (msg.type === 'answer') {
				console.log(chalk.green('Received answer'))
				peerConnection.setRemoteDescription(
					new RTCSessionDescription(msg.data),
				)
			}

			if (msg.type === 'ice-candidate') {
				console.log(chalk.yellow('Received ICE candidate'))
				peerConnection.addIceCandidate(new RTCIceCandidate(msg.data))
			}
		}
	}, [ws, id, targetID, role])

	// 鼠标事件
	useEffect(() => {
		if (role !== 'receiver') return
		if (!dataChannel) return

		const video = videoElemRef.current

		const send = (data: any) => {
			console.log(chalk.yellow('Sending data...'), data)
			dataChannel.send(data)
		}

		// 使用 adb 的 input motionevent 转发鼠标事件

		// 由于视频缩放过，这里需要获取视频的实际大小
		const src = video.srcObject as MediaStream
		const srcSettings = src.getVideoTracks()[0].getSettings()
		let screenWidth = srcSettings.width!
		let screenHeight = srcSettings.height!

		let pointerDown = false

		// move 事件限流
		const moveThrottle = 1000 / 30
		let lastMoveTime = performance.now()

		const onDown = (event: MouseEvent) => {
			const displayRect = video.getBoundingClientRect()
			const src = video.srcObject as MediaStream
			const srcSettings = src.getVideoTracks()[0].getSettings()
			screenWidth = srcSettings.width!
			screenHeight = srcSettings.height!

			console.log('screenWidth:', screenWidth)
			console.log('screenHeight:', screenHeight)

			pointerDown = true

			const x = event.clientX - displayRect.left
			const y = event.clientY - displayRect.top

			console.log('x:', x)
			console.log('y:', y)

			const xInScreen = (x / displayRect.width) * screenWidth
			const yInScreen = (y / displayRect.height) * screenHeight

			send(`su -c input motionevent DOWN ${xInScreen} ${yInScreen}`)
		}

		const onMove = (event: MouseEvent) => {
			if (!pointerDown) return

			const now = performance.now()
			if (now - lastMoveTime < moveThrottle) return
			lastMoveTime = now

			const displayRect = video.getBoundingClientRect()

			const x = event.clientX - displayRect.left
			const y = event.clientY - displayRect.top

			const xInScreen = (x / displayRect.width) * screenWidth
			const yInScreen = (y / displayRect.height) * screenHeight

			send(`su -c input motionevent MOVE ${xInScreen} ${yInScreen}`)
		}

		const onUp = (event: MouseEvent) => {
			pointerDown = false

			const displayRect = video.getBoundingClientRect()

			const x = event.clientX - displayRect.left
			const y = event.clientY - displayRect.top

			const xInScreen = (x / displayRect.width) * screenWidth
			const yInScreen = (y / displayRect.height) * screenHeight

			send(`su -c input motionevent UP ${xInScreen} ${yInScreen}`)
		}

		video.addEventListener('mousedown', onDown)
		video.addEventListener('mousemove', onMove)
		video.addEventListener('mouseup', onUp)

		return () => {
			video.removeEventListener('mousedown', onDown)
			video.removeEventListener('mousemove', onMove)
			video.removeEventListener('mouseup', onUp)
		}
	}, [role, dataChannel])

	return (
		<div
			style={{
				width: '100vw',
				height: '100vh',
				justifyContent: 'center',
				alignItems: 'center',
				display: 'flex',
				position: 'relative',
			}}
		>
			<video
				style={{
					maxWidth: '100%',
					maxHeight: '100%',
					position: 'relative',
				}}
				id="source"
				controls={role === 'sender'}
				muted
				loop={role === 'sender'}
				autoPlay
				// 要加上这个 Safari iOS 才能工作
				playsInline
				ref={videoElemRef}
			>
				{role === 'sender' && (
					<source src="/la-luna.mp4" type="video/mp4" />
				)}
			</video>
		</div>
	)
}

export default Page
