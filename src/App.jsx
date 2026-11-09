import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

// Harita merkezini dinamik olarak değiştirmek için yardımcı bileşen
function MapCenterUpdater({ center }) {
  const map = useMap();
  if (center) {
    map.flyTo(center, 16, { duration: 1.5 }); // 16 zoom seviyesi ile yumuşak geçiş
  }
  return null;
}

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
  const [focusedLocation, setFocusedLocation] = useState(null); // Tıklanan satırın koordinatını tutar
  
  const [formData, setFormData] = useState({
    code: 'TRK-002', label: 'Test Aracı', transaction_id: 'TXN-' + Math.floor(Math.random() * 10000),
    latitude: 41.0150, longitude: 28.9850
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  useEffect(() => {
    fetchNodes();
  }, [apiKey]);

  const handleAddNode = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        event_date: new Date().toISOString()
      };
      await axios.post(`${API_URL}/nodes`, payload, {
        headers: { 'X-API-Key': apiKey }
      });
      await fetchNodes();
      // Yeni eklenen konuma otomatik odaklan
      setFocusedLocation([formData.latitude, formData.longitude]);
      setFormData({ ...formData, transaction_id: 'TXN-' + Math.floor(Math.random() * 10000) });
    } catch (error) {
      alert("Kayıt sırasında hata oluştu!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultCenter = [41.0082, 28.9784];
  const mapCenter = nodes.length > 0 && nodes[nodes.length-1].latitude 
    ? [nodes[nodes.length-1].latitude, nodes[nodes.length-1].longitude] 
    : defaultCenter;

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
        <h2>Hoş Geldiniz, {tenantName}</h2>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#666', backgroundColor: '#f0f0f0', padding: '4px 8px', borderRadius: '4px' }}>
            API Key: {apiKey.substring(0, 8)}...
          </span>
          <button onClick={onLogout} style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}>Çıkış Yap</button>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '300px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3>Manuel Konum Gönder</h3>
          <form onSubmit={handleAddNode} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" placeholder="Araç Kodu" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} style={{ padding: '8px' }} required />
            <input type="text" placeholder="Etiket" value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} style={{ padding: '8px' }} required />
            <input type="number" step="any" placeholder="Enlem (Latitude)" value={formData.latitude} onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})} style={{ padding: '8px' }} required />
            <input type="number" step="any" placeholder="Boylam (Longitude)" value={formData.longitude} onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})} style={{ padding: '8px' }} required />
            <button type="submit" disabled={isSubmitting} style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
              {isSubmitting ? 'Gönderiliyor...' : 'API\'ye Gönder'}
            </button>
          </form>
        </div>

        <div style={{ flex: '2', minWidth: '400px', height: '350px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc' }}>
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {/* Odaklayıcı bileşeni haritanın içine yerleştiriyoruz */}
            <MapCenterUpdater center={focusedLocation} />

            {nodes.map(node => (
              node.latitude && node.longitude && (
                <Marker key={node.id} position={[node.latitude, node.longitude]}>
                  <Popup><strong>{node.code}</strong><br/>{node.label}<br/>{new Date(node.event_date).toLocaleTimeString('tr-TR')}</Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h3>Son Konum ve İşlem Verileri</h3>
        {loading ? <p>Yükleniyor...</p> : nodes.length === 0 ? <p>Kayıt yok.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontSize: '9px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>Tarih</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>Kod</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>İşlem ID</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>Koordinat</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map(node => (
                  <tr 
                    key={node.id} 
                    onClick={() => setFocusedLocation([node.latitude, node.longitude])} // Satıra tıklanınca konumu ayarla
                    style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f1f1'} // Üzerine gelince hover efekti
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '8px' }}>{new Date(node.event_date).toLocaleString('tr-TR')}</td>
                    <td style={{ padding: '8px' }}><strong>{node.code}</strong><br/>{node.label}</td>
                    <td style={{ padding: '8px' }}>{node.transaction_id}</td>
                    <td style={{ padding: '8px' }}>{node.latitude}, {node.longitude}</td>
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