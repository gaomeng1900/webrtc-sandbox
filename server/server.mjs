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

wsServer.on('connection', (ws, req) => {
	const url = new URL(req.url, `https://${req.headers.host}`)
	const searchParams = url.searchParams
	const id = searchParams.get('id')

	console.log(chalk.greenBright.bold('new connection', 'id:', id))

	ws.on('message', (message) => {
		console.log(
			chalk.blue.bold(id),
			chalk.magenta.bold(`received:`),
			message.toString(),
		)

		ws.send(`got`)
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
