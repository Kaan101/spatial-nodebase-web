import { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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

function MapCenterUpdater({ center }) {
  const map = useMap();
  if (center) {
    map.flyTo(center, 6, { duration: 1.5 }); 
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
  const [focusedLocation, setFocusedLocation] = useState(null); 
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    code: 'TRK-002', label: 'Test Aracı', transaction_id: 'TXN-' + Math.floor(Math.random() * 10000),
    latitude: 41.0150, longitude: 28.9850
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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
      setFocusedLocation([formData.latitude, formData.longitude]);
      setFormData({ ...formData, transaction_id: 'TXN-' + Math.floor(Math.random() * 10000) });
    } catch (error) {
      alert("Kayıt sırasında hata oluştu!");
    } finally {
      setIsSubmitting(false);
    }
  };

  // NATIVE CSV İNDİRME (Kütüphanesiz)
  const handleExportCSV = () => {
    const headers = ['Tarih', 'Kod', 'Açıklama', 'İşlem ID', 'Enlem', 'Boylam'];
    const csvRows = [headers.join(',')]; // Başlık satırı

    nodes.forEach(node => {
      const row = [
        new Date(node.event_date).toLocaleString('tr-TR'),
        node.code,
        node.label,
        node.transaction_id,
        node.latitude,
        node.longitude
      ];
      // Verilerde virgül olma ihtimaline karşı tırnak içine alıyoruz
      csvRows.push(row.map(v => `"${v}"`).join(','));
    });

    const csvString = csvRows.join('\n');
    // UTF-8 BOM ekleyerek Excel'in Türkçe karakterleri düzgün tanımasını sağlıyoruz
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Spatial_NodeBase_Veriler.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // NATIVE CSV İÇERİ AKTARMA (Kütüphanesiz)
  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const rows = text.split('\n');
        if (rows.length < 2) throw new Error("Veri bulunamadı.");

        // Başlıkları al ve tırnakları temizle
        const headers = rows[0].split(',').map(h => h.replace(/"/g, '').trim());
        const codeIdx = headers.indexOf('Kod');
        const labelIdx = headers.indexOf('Açıklama');
        const latIdx = headers.indexOf('Enlem');
        const lngIdx = headers.indexOf('Boylam');
        const txnIdx = headers.indexOf('İşlem ID');

        if (codeIdx === -1 || latIdx === -1 || lngIdx === -1) {
          throw new Error("Gerekli sütunlar (Kod, Enlem, Boylam) bulunamadı.");
        }

        // Satırları tek tek API'ye gönder
        for (let i = 1; i < rows.length; i++) {
          if (!rows[i].trim()) continue; // Boş satırları atla
          
          // Satırı virgüllerden böl ve tırnakları temizle
          const cols = rows[i].split(',').map(c => c.replace(/"/g, '').trim());
          
          if (cols[codeIdx] && cols[latIdx] && cols[lngIdx]) {
            const payload = {
              code: cols[codeIdx],
              label: labelIdx !== -1 ? cols[labelIdx] : 'CSV İçeri Aktarım',
              latitude: parseFloat(cols[latIdx]),
              longitude: parseFloat(cols[lngIdx]),
              transaction_id: (txnIdx !== -1 && cols[txnIdx]) ? cols[txnIdx] : 'TXN-CSV-' + Math.floor(Math.random() * 10000),
              event_date: new Date().toISOString()
            };
            await axios.post(`${API_URL}/nodes`, payload, {
              headers: { 'X-API-Key': apiKey }
            });
          }
        }
        alert("CSV verileri başarıyla sisteme yüklendi!");
        await fetchNodes();
      } catch (error) {
        console.error(error);
        alert("CSV okunurken hata oluştu! Dosyanın doğru formatta olduğundan emin olun.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file); // Metin olarak oku
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
            <input type="text" placeholder="Açıklama/Etiket" value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} style={{ padding: '8px' }} required />
            <input type="number" step="any" placeholder="Enlem (Latitude)" value={formData.latitude} onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})} style={{ padding: '8px' }} required />
            <input type="number" step="any" placeholder="Boylam (Longitude)" value={formData.longitude} onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})} style={{ padding: '8px' }} required />
            <button type="submit" disabled={isSubmitting || isImporting} style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: (isSubmitting || isImporting) ? 'not-allowed' : 'pointer' }}>
              {isSubmitting ? 'Gönderiliyor...' : 'API\'ye Gönder'}
            </button>
          </form>
        </div>

        <div style={{ flex: '2', minWidth: '400px', height: '350px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc' }}>
          <MapContainer center={mapCenter} zoom={6} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Son Konum ve İşlem Verileri</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleImportCSV} 
              ref={fileInputRef}
              style={{ display: 'none' }} 
            />
            <button 
              onClick={() => fileInputRef.current.click()} 
              disabled={isImporting}
              style={{ padding: '6px 12px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: isImporting ? 'not-allowed' : 'pointer', fontSize: '12px' }}
            >
              {isImporting ? 'Yükleniyor...' : '⬆️ CSV Yükle'}
            </button>
            <button 
              onClick={handleExportCSV} 
              style={{ padding: '6px 12px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
            >
              ⬇️ CSV İndir
            </button>
          </div>
        </div>
        
        {loading ? <p>Yükleniyor...</p> : nodes.length === 0 ? <p>Kayıt yok.</p> : (
          <div style={{ overflowX: 'auto', marginTop: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontSize: '11px', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                  <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Tarih</th>
                  <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Kod</th>
                  <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Açıklama</th>
                  <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>İşlem ID</th>
                  <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Koordinat</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map(node => (
                  <tr 
                    key={node.id} 
                    onClick={() => setFocusedLocation([node.latitude, node.longitude])} 
                    style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f1f1'} 
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '10px' }}>{new Date(node.event_date).toLocaleString('tr-TR')}</td>
                    <td style={{ padding: '10px' }}><strong>{node.code}</strong></td>
                    <td style={{ padding: '10px' }}>{node.label}</td>
                    <td style={{ padding: '10px' }}>{node.transaction_id}</td>
                    <td style={{ padding: '10px' }}>{node.latitude}, {node.longitude}</td>
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
    <HashRouter>
      <Routes>
        <Route path="/" element={
          apiKey ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />
        } />
        <Route path="/dashboard" element={
          apiKey ? <Dashboard tenantName={tenantName} apiKey={apiKey} onLogout={handleLogout} /> : <Navigate to="/" />
        } />
      </Routes>
    </HashRouter>
  );
}