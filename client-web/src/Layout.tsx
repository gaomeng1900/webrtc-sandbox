import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import adapter from 'webrtc-adapter'
console.log(
	'adapter',
	adapter.browserDetails.browser,
	adapter.browserDetails.version,
)

import Websocket from './pages/Websocket'
import RTC from './pages/RTC'

const router = createBrowserRouter([
	{
		path: '/',
		element: <div>Hello world!</div>,
	},
	{
		path: '/ws',
		element: <Websocket />,
	},
	{
		path: '/rtc',
		element: <RTC />,
	},
])

export default function Layout() {
	return <RouterProvider router={router}></RouterProvider>
}
