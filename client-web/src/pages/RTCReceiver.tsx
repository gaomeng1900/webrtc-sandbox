/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import chalk from 'chalk'

import settings from './settings.json'

const peerConnectionOptions = {
	iceServers: [
		{
			urls: settings.stun,
			username: settings.stun_username,
			credential: settings.stun_password,
		},
		{
			urls: settings.turn,
			username: settings.turn_username,
			credential: settings.turn_password,
		},
	],
}

function Page() {
	const searchParams = new URLSearchParams(window.location.search)
	const id = searchParams.get('id')
	const targetID = searchParams.get('targetID')

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

		const url = `${settings.ws_server}?id=${id}`

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

	// 接受侧
	useEffect(() => {
		if (!ws) return
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

			console.log('remote strean', event.streams[0])

			// 注意，接收端拿到的 sender 没有用，要在发送端拿到 sender 修改视频参数
			// const senders = peerConnection.getSenders()
			// console.log('senders:', senders)
			// const params = senders[0].getParameters()
			// console.log('params:', params)
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
	}, [ws, id, targetID])

	// 鼠标事件
	const pointerRef = useRef<HTMLDivElement>(null!)

	useEffect(() => {
		if (!dataChannel) return

		const video = videoElemRef.current
		const pointer = pointerRef.current

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

			// pointer.style.visibility = 'visible'
			pointer.style.backgroundColor = '#ffffffaa'
			pointer.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`

			const x = event.clientX - displayRect.left
			const y = event.clientY - displayRect.top

			const xInScreen = (x / displayRect.width) * screenWidth
			const yInScreen = (y / displayRect.height) * screenHeight

			send(`su -c input motionevent DOWN ${xInScreen} ${yInScreen}`)
		}

		const onMove = (event: MouseEvent) => {
			const displayRect = video.getBoundingClientRect()
			pointer.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`

			if (!pointerDown) return

			const now = performance.now()
			if (now - lastMoveTime < moveThrottle) return
			lastMoveTime = now

			const x = event.clientX - displayRect.left
			const y = event.clientY - displayRect.top

			const xInScreen = (x / displayRect.width) * screenWidth
			const yInScreen = (y / displayRect.height) * screenHeight

			send(`su -c input motionevent MOVE ${xInScreen} ${yInScreen}`)
		}

		const onUp = (event: MouseEvent) => {
			pointerDown = false

			const displayRect = video.getBoundingClientRect()

			// pointer.style.visibility = 'hidden'
			pointer.style.backgroundColor = '#ffffff77'

			const x = event.clientX - displayRect.left
			const y = event.clientY - displayRect.top

			const xInScreen = (x / displayRect.width) * screenWidth
			const yInScreen = (y / displayRect.height) * screenHeight

			send(`su -c input motionevent UP ${xInScreen} ${yInScreen}`)
		}

		const onEnter = (event: MouseEvent) => {
			pointer.style.visibility = 'visible'
		}

		const onOut = (event: MouseEvent) => {
			pointer.style.visibility = 'hidden'

			if (!pointerDown) return
			pointerDown = false

			const displayRect = video.getBoundingClientRect()

			const x = event.clientX - displayRect.left
			const y = event.clientY - displayRect.top

			const minmax = (min: number, max: number, value: number) =>
				Math.min(max, Math.max(min, value))

			const xInScreen = minmax(
				0,
				screenWidth,
				(x / displayRect.width) * screenWidth,
			)
			const yInScreen = minmax(
				0,
				screenHeight,
				(y / displayRect.height) * screenHeight,
			)

			send(`su -c input motionevent UP ${xInScreen} ${yInScreen}`)
		}

		video.addEventListener('mousedown', onDown)
		video.addEventListener('mousemove', onMove)
		video.addEventListener('mouseup', onUp)
		video.addEventListener('mouseenter', onEnter)
		video.addEventListener('mouseout', onOut)

		return () => {
			video.removeEventListener('mousedown', onDown)
			video.removeEventListener('mousemove', onMove)
			video.removeEventListener('mouseup', onUp)
			video.removeEventListener('mouseenter', onEnter)
			video.removeEventListener('mouseout', onOut)
		}
	}, [dataChannel])

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
				muted
				autoPlay
				// 要加上这个 Safari iOS 才能工作
				playsInline
				ref={videoElemRef}
			></video>

			{/* 鼠标 */}
			<div
				ref={pointerRef}
				style={{
					visibility: 'hidden',
					position: 'absolute',
					top: '-20px',
					left: '-20px',
					width: '40px',
					height: '40px',
					backgroundColor: '#ffffff77',
					borderRadius: '50%',
					pointerEvents: 'none',
					transition: 'backgroundColor 0.3s',
					boxShadow: '0 0 10px 5px #ffffff55',
				}}
			/>
		</div>
	)
}

export default Page
