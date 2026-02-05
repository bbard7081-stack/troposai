import React from 'react'

export default function ScreenPop({ event, onClose }: { event: any, onClose: () => void }) {
  const caller = event && (event.body?.from?.phoneNumber || event.body?.from?.extension?.phoneNumber || 'Unknown')
  return (
    <div className="screen-pop">
      <div className="card">
        <button className="close" onClick={onClose}>×</button>
        <h3>Incoming Call</h3>
        <p><strong>Caller:</strong> {caller}</p>
        <pre className="payload">{JSON.stringify(event, null, 2)}</pre>
      </div>
    </div>
  )
}
