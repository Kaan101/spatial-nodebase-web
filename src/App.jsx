import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// React-Leaflet için standart pin (ikon) sorununun Vite özelindeki çözümü
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

const API_URL = import.meta.env.VITE_API_URL;

function Login({ onLogin }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.get(`${API_URL}/me`, {
        headers: { 'X-API-Key': key }
      });
      onLogin(key, res.data.name);
      navigate('/dashboard');
    } catch (err) {
      setError('Geçersiz API Key! Lütfen kontrol edin.');
    }
  };

  return (
    <div style={{ padding: '50px', maxWidth: '400px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>Spatial NodeBase Giriş</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input 
          type="text" 
          placeholder="sn_... ile başlayan API Key'inizi girin" 
          value={key} 
          onChange={(e) => setKey(e.target.value)}
          style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
          required 
        />
        <button type="submit" style={{ padding: '10px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#000', color: 'white', border: 'none', borderRadius: '4px' }}>
          Giriş Yap
        </button>
      </form>
      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
    </div>
  );
}

function Dashboard({ tenantName, apiKey, onLogout }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const res = await axios.get(`${API_URL}/nodes`, {
          headers: { 'X-API-Key': apiKey }
        });
        setNodes(res.data);
      } catch (error) {
        console.error("Veri çekme hatası:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchNodes();
  }, [apiKey]);

  // Haritanın merkezini belirleme (Veri yoksa varsayılan İstanbul)
  const defaultCenter = [41.0082, 28.9784];
  const mapCenter = nodes.length > 0 && nodes[0].latitude && nodes[0].longitude 
    ? [nodes[0].latitude, nodes[0].longitude] 
    : defaultCenter;

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
        <h2>Hoş Geldiniz, {tenantName}</h2>
        <button onClick={onLogout} style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}>Çıkış Yap</button>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h3>Canlı Filo Takip Haritası</h3>
        
        {/* Harita Konteyneri */}
        <div style={{ height: '400px', width: '100%', marginBottom: '30px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc' }}>
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {nodes.map(node => (
              node.latitude && node.longitude && (
                <Marker key={node.id} position={[node.latitude, node.longitude]}>
                  <Popup>
                    <strong>{node.code}</strong> <br/>
                    {node.label} <br/>
                    İşlem: {node.transaction_id} <br/>
                    Tarih: {new Date(node.event_date).toLocaleString('tr-TR')}
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>

        <h3>Son Konum ve İşlem Verileri</h3>
        {loading ? (
          <p>Veriler buluttan yükleniyor...</p>
        ) : nodes.length === 0 ? (
          <p>Henüz sistemde hiç kayıtlı konum verisi yok.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                  <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Tarih</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Kod</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Etiket</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>İşlem ID</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Enlem</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Boylam</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map(node => (
                  <tr key={node.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>{new Date(node.event_date).toLocaleString('tr-TR')}</td>
                    <td style={{ padding: '12px' }}><strong>{node.code}</strong></td>
                    <td style={{ padding: '12px' }}>{node.label}</td>
                    <td style={{ padding: '12px' }}>{node.transaction_id}</td>
                    <td style={{ padding: '12px' }}>{node.latitude}</td>
                    <td style={{ padding: '12px' }}>{node.longitude}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('apiKey') || '');
  const [tenantName, setTenantName] = useState(localStorage.getItem('tenantName') || '');

  const handleLogin = (key, name) => {
    setApiKey(key);
    setTenantName(name);
    localStorage.setItem('apiKey', key);
    localStorage.setItem('tenantName', name);
  };

  const handleLogout = () => {
    setApiKey('');
    setTenantName('');
    localStorage.removeItem('apiKey');
    localStorage.removeItem('tenantName');
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          apiKey ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />
        } />
        <Route path="/dashboard" element={
          apiKey ? <Dashboard tenantName={tenantName} apiKey={apiKey} onLogout={handleLogout} /> : <Navigate to="/" />
        } />
      </Routes>
    </BrowserRouter>
  );
}