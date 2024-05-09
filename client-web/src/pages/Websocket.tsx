import { useEffect, useState } from 'react'

import chalk from 'chalk'

function Page() {
	const searchParams = new URLSearchParams(window.location.search)
	const id = searchParams.get('id')
	const ip = searchParams.get('ip')

	const [ws, setWs] = useState<WebSocket | null>(null)

	useEffect(() => {
		console.log(chalk.greenBright.bold.bgBlack('Initing App...'))

		if (!id || !ip) {
			console.error(chalk.red('Missing id or ip in query params'))
			return
		}

		const url = `wss://${ip}:443?id=${id}`

		const ws = new WebSocket(url)

		ws.onopen = () => {
			console.log(chalk.greenBright.bold.bgBlack('Connected to server'))

			setWs(ws)

			ws.send('hahahha')
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
	}, [id, ip])
	return <></>
}

export default Page
