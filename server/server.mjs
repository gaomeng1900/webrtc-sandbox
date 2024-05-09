import { WebSocketServer } from 'ws'
import https from 'https'
import selfSigned from 'openssl-self-signed-certificate'
import chalk from 'chalk'

const serverOptions = {
	key: selfSigned.key,
	cert: selfSigned.cert,
}

/**
 * @note chrome 要求 wss 必须通过 443 端口，否则直接拒绝连接
 * @see https://stackoverflow.com/questions/32693376/websocket-connection-on-wss-failed
 */
const port = 443

const config = {
	// ICE 相关设置，内网无需穿透的情况下不需要特殊处理
	// `clientConfig` is send to Streamer and Players
	// Example of STUN server setting
	// let clientConfig = {peerConnectionOptions: { 'iceServers': [{'urls': ['stun:34.250.222.95:19302']}] }};
	clientConfig: { type: 'config', peerConnectionOptions: {} },
}

const server = https.createServer(serverOptions)
const wsServer = new WebSocketServer({ server })

const sockets = new Map()

/**
 * 请求的消息格式
 *
 * @typedef {Object} RequestMessage
 * @property {string} type - 消息类型
 * @property {string} [data] - 数据，若为空则不发送
 * @property {string} [targetID] - 发送目标的 ID，若为空则不发送
 */

wsServer.on('connection', (ws, req) => {
	const url = new URL(req.url, `https://${req.headers.host}`)
	const searchParams = url.searchParams
	const id = searchParams.get('id')
	const clientIP = req.socket.remoteAddress

	console.log(
		chalk.greenBright.bold('new connection:', 'id:', id, ', ip:', clientIP),
	)

	ws.on('message', (message) => {
		console.log(
			chalk.blue.bold(id),
			chalk.magenta.bold(`received:`),
			message.toString(),
		)

		if (!id) {
			const res = {
				success: false,
				type: 'reg_respose',
				error: 'id is required',
			}

			ws.send(JSON.stringify(res))
			return
		}

		sockets.set(id, ws)

		try {
			const msg = JSON.parse(message)
			const { type, data, targetID } = msg

			if (data && targetID) {
				const targetSocket = sockets.get(targetID)
				if (targetSocket) {
					targetSocket.send(
						JSON.stringify({ type, data, sourceID: id }),
					)
				} else {
					console.log(
						chalk.yellow.bold('target socket not found:', targetID),
					)

					// const res = {
					// 	success: false,
					// 	type: 'reg_respose',
					// 	error: 'target socket not found',
					// }
					// ws.send(JSON.stringify(res))
					// return
				}
			}

			const res = { success: true, type: 'reg_respose' }
			ws.send(JSON.stringify(res))
		} catch (error) {
			if (error instanceof SyntaxError) {
				console.log(chalk.yellow('json 无法解析', message.toString()))

				const res = {
					success: false,
					type: 'reg_respose',
					error: 'invalid json',
				}
				ws.send(JSON.stringify(res))
				return
			} else {
				console.log(chalk.red.bold('未知错误'), error)
			}
		}
	})

	ws.on('close', () => {
		console.log('connection closed')
	})

	ws.on('error', (err) => {
		console.error(err)
	})
})

server.listen(port, () => {
	console.log(
		chalk.green(`Server is running on ${server.address().address}:${port}`),
	)
})
