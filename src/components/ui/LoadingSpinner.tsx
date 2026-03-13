// ── Loading Spinner ──────────────────────────────────────────
export default function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#f9fafb', gap:16 }}>
      <div style={{ position:'relative', width:48, height:48 }}>
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'4px solid #e5e7eb' }} />
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'4px solid #16a34a', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
      </div>
      <p style={{ color:'#6b7280', fontSize:14 }}>{message}</p>
    </div>
  );
}
