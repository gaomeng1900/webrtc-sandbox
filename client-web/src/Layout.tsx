import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import Websocket from './pages/Websocket'

const router = createBrowserRouter([
	{
		path: '/',
		element: <div>Hello world!</div>,
	},
	{
		path: '/ws',
		element: <Websocket />,
	},
])

export default function Layout() {
	return <RouterProvider router={router}></RouterProvider>
}
