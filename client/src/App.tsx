import React, { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import ScreenPop from './ScreenPop'

type CallEvent = any

const socket = io('http://localhost:3001')

export default function App() {
  const [events, setEvents] = useState<CallEvent[]>([])
  const [activeCall, setActiveCall] = useState<CallEvent | null>(null)

  useEffect(() => {
    socket.on('incoming_call', (evt: CallEvent) => {
      setEvents(prev => [evt, ...prev].slice(0, 50))
      setActiveCall(evt)
    })
    return () => { socket.off('incoming_call') }
  }, [])

  return (
    <div className="container">
      <h1>Active Call Dashboard</h1>
      {activeCall && <ScreenPop event={activeCall} onClose={() => setActiveCall(null)} />}

      <section>
        <h2>Recent events</h2>
        <ul>
          {events.map((e, i) => (
            <li key={i}>{JSON.stringify(e)}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
