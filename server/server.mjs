import { WebSocketServer } from 'ws'
import https from 'https'
import http from 'http'
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
// const port = 443
const port = 80

/**
 * getUserMedia 需要 https，用不到这个接口的话用 http
 * safari 不支持 self signed certificate wss
 */
// const server = https.createServer(serverOptions)
const server = http.createServer()
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
	const url = new URL(req.url, `http://${req.headers.host}`)
	const searchParams = url.searchParams
	const id = searchParams.get('id')
	const clientIP = req.socket.remoteAddress

	console.log(
		chalk.greenBright.bold('🌟 new connection:'),
		chalk.green(id, '@', clientIP),
	)

	// 注册 IP 并发送注册结果

	if (!id) {
		const res = {
			success: false,
			type: 'register',
			error: 'id is required',
		}

		console.log(chalk.red.bold('id is required'))

		ws.send(JSON.stringify(res))
		return
	}

	if (!sockets.get(id)) {
		const res = { success: true, type: 'register' }
		ws.send(JSON.stringify(res))
	} else if (sockets.get(id) !== ws) {
		console.log(
			chalk.yellow.bold('\t└ id already registered:', id),
			chalk.yellow.bold('replacing socket'),
		)

		const res = {
			success: true,
			type: 'register',
			message: 'id already registered, replacing the existing socket.',
		}
		ws.send(JSON.stringify(res))
	}

	sockets.set(id, ws)

	// 接收消息

	ws.on('message', (message) => {
		const str = message.toString()
		console.log(
			'📩',
			chalk.blue.bold(id),
			chalk.magenta.bold(`received:`),
			str.slice(0, 80) + (str.length > 80 ? '...' : ''),
		)

		try {
			const msg = JSON.parse(message)
			const { type, data, targetID } = msg

			// 转发

			if (data && targetID) {
				const targetSocket = sockets.get(targetID)
				if (targetSocket) {
					targetSocket.send(
						JSON.stringify({ type, data, sourceID: id }),
					)
					console.log(
						chalk.magenta.bold(`\t└ transfer to ${targetID} ✅`),
					)
				} else {
					console.log(
						chalk.yellow.bold(
							'\t└ target socket not found:',
							targetID,
						),
					)

					const res = {
						success: false,
						type: 'error',
						error: 'target socket not found',
					}
					ws.send(JSON.stringify(res))
					return
				}
			}
		} catch (error) {
			if (error instanceof SyntaxError) {
				console.log(chalk.yellow('json 无法解析', message.toString()))

				const res = {
					success: false,
					type: 'error',
					error: 'invalid json',
				}
				ws.send(JSON.stringify(res))
				return
			} else {
				console.log(chalk.red.bold('未知错误'), error)

				const res = {
					success: false,
					type: 'error',
					error: error.message,
				}
				ws.send(JSON.stringify(res))
				return
			}
		}
	})

	ws.on('close', () => {
		console.log(chalk.red.bold('👋 connection closed:', id))
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
