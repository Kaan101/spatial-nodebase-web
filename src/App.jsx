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

function MapResizer({ viewMode, isFormVisible, isListOpen, listWidth }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 200); 
  }, [viewMode, isFormVisible, isListOpen, listWidth, map]);
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
  
  const [viewMode, setViewMode] = useState(1); 
  const [isFormVisible, setIsFormVisible] = useState(false); 
  
  const [isListOpen, setIsListOpen] = useState(false); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [selectedFirm, setSelectedFirm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [listWidth, setListWidth] = useState('25%'); 

  const [formData, setFormData] = useState({
    code: 'TRK-002', 
    label: 'Test Aracı', 
    definition: 'Soğuk zincir sevkiyatı',
    transaction_id: 'TXN-' + Math.floor(Math.random() * 10000),
    unit: 'Lojistik',
    firm: 'Mobool A.Ş.',
    branch: 'Anadolu Şubesi',
    latitude: 41.0150, 
    longitude: 28.9850,
    country: 'Türkiye',
    region: 'Marmara',
    city: 'İstanbul',
    address: 'İkitelli OSB',
    postalcode: '34306'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fetchNodes = async () => {
    try {
      const res = await axios.get(`${API_URL}/nodes`, {
        headers: { 'X-API-Key': apiKey }
      });
      
      const uniqueNodes = [];
      const seen = new Set();
      
      res.data.forEach(node => {
        const uniqueKey = `${node.code}_${node.transaction_id}_${node.latitude}_${node.longitude}`;
        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          uniqueNodes.push(node);
        }
      });

      uniqueNodes.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
      setNodes(uniqueNodes);
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!apiKey) return;
    fetchNodes(); 
    const intervalId = setInterval(fetchNodes, 3000); 
    return () => clearInterval(intervalId); 
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
      setFormData(prev => ({
        ...prev,
        transaction_id: 'TXN-' + Math.floor(Math.random() * 10000)
      }));
      setIsFormVisible(false); 
    } catch (error) {
      alert("Kayıt sırasında hata oluştu!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Tarih', 'Kod', 'Etiket', 'Açıklama', 'İşlem ID', 'Birim', 'Firma', 'Şube', 'Enlem', 'Boylam', 'Ülke', 'Bölge', 'Şehir', 'Adres', 'Posta Kodu'];
    const csvRows = [headers.join(',')];

    nodes.forEach(node => {
      const row = [
        new Date(node.event_date).toLocaleString('tr-TR'),
        node.code,
        node.label || '',
        node.definition || '',
        node.transaction_id || '',
        node.unit || '',
        node.firm || '',
        node.branch || '',
        node.latitude,
        node.longitude,
        node.country || '',
        node.region || '',
        node.city || '',
        node.address || '',
        node.postalcode || ''
      ];
      csvRows.push(row.map(v => `"${v}"`).join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Spatial_NodeBase_Veriler.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

        const headers = rows[0].split(',').map(h => h.replace(/"/g, '').trim());
        const codeIdx = headers.indexOf('Kod');
        const latIdx = headers.indexOf('Enlem');
        const lngIdx = headers.indexOf('Boylam');

        if (codeIdx === -1 || latIdx === -1 || lngIdx === -1) {
          throw new Error("Gerekli sütunlar (Kod, Enlem, Boylam) bulunamadı.");
        }

        for (let i = 1; i < rows.length; i++) {
          if (!rows[i].trim()) continue;
          const cols = rows[i].split(',').map(c => c.replace(/"/g, '').trim());
          if (cols[codeIdx] && cols[latIdx] && cols[lngIdx]) {
            const payload = {
              code: cols[codeIdx],
              label: cols[headers.indexOf('Etiket')] || 'CSV Kayıt',
              definition: cols[headers.indexOf('Açıklama')] || '',
              transaction_id: cols[headers.indexOf('İşlem ID')] || 'TXN-CSV-' + Math.floor(Math.random() * 10000),
              unit: cols[headers.indexOf('Birim')] || '',
              firm: cols[headers.indexOf('Firma')] || '',
              branch: cols[headers.indexOf('Şube')] || '',
              latitude: parseFloat(cols[latIdx]),
              longitude: parseFloat(cols[lngIdx]),
              country: cols[headers.indexOf('Ülke')] || '',
              region: cols[headers.indexOf('Bölge')] || '',
              city: cols[headers.indexOf('Şehir')] || '',
              address: cols[headers.indexOf('Adres')] || '',
              postalcode: cols[headers.indexOf('Posta Kodu')] || '',
              event_date: new Date().toISOString()
            };
            await axios.post(`${API_URL}/nodes`, payload, {
              headers: { 'X-API-Key': apiKey }
            });
          }
        }
        alert("CSV verileri başarıyla yüklendi!");
        await fetchNodes();
      } catch (error) {
        console.error(error);
        alert("Hata oluştu! Dosya formatını kontrol edin.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Dinamik Filtre Listeleri (Benzersiz Firma ve Şehirler)
  const uniqueFirms = [...new Set(nodes.map(n => n.firm).filter(Boolean))];
  const uniqueCities = [...new Set(nodes.map(n => n.city).filter(Boolean))];

  // Filtrelenmiş Düğümler (Arama, Firma ve Şehir Kriterlerine Göre)
  const filteredNodes = nodes.filter(node => {
    const matchesSearch = 
      node.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (node.label && node.label.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (node.city && node.city.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFirm = selectedFirm ? node.firm === selectedFirm : true;
    const matchesCity = selectedCity ? node.city === selectedCity : true;

    return matchesSearch && matchesFirm && matchesCity;
  });

  const defaultCenter = [41.0082, 28.9784];
  const mapCenter = filteredNodes.length > 0 && filteredNodes[0].latitude 
    ? [filteredNodes[0].latitude, filteredNodes[0].longitude] 
    : defaultCenter;

  const renderForm = () => (
    <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd', maxHeight: '550px', overflowY: 'auto' }}>
      <h3 style={{ marginTop: '0' }}>Yeni Konum ve Detay Ekle</h3>
      <form onSubmit={handleAddNode} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input type="text" placeholder="Araç/Cihaz Kodu *" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} style={{ padding: '7px' }} required />
        <input type="text" placeholder="Serbest Metin / Etiket (label)" value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} style={{ padding: '7px' }} />
        <input type="text" placeholder="Detaylı Tanım (definition)" value={formData.definition} onChange={e => setFormData({...formData, definition: e.target.value})} style={{ padding: '7px' }} />
        <input type="text" placeholder="İşlem veya Sinyal Takip ID" value={formData.transaction_id} onChange={e => setFormData({...formData, transaction_id: e.target.value})} style={{ padding: '7px' }} />
        <input type="text" placeholder="Birim Bilgisi (unit)" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} style={{ padding: '7px' }} />
        <input type="text" placeholder="Kurum veya Firma Adı (firm)" value={formData.firm} onChange={e => setFormData({...formData, firm: e.target.value})} style={{ padding: '7px' }} />
        <input type="text" placeholder="Şube veya Departman (branch)" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})} style={{ padding: '7px' }} />
        <input type="number" step="any" placeholder="Enlem (Latitude) *" value={formData.latitude} onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})} style={{ padding: '7px' }} required />
        <input type="number" step="any" placeholder="Boylam (Longitude) *" value={formData.longitude} onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})} style={{ padding: '7px' }} required />
        <input type="text" placeholder="Ülke Bilgisi (country)" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} style={{ padding: '7px' }} />
        <input type="text" placeholder="Bölge Bilgisi (region)" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} style={{ padding: '7px' }} />
        <input type="text" placeholder="Şehir Bilgisi (city)" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} style={{ padding: '7px' }} />
        <input type="text" placeholder="Açık Adres (address)" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} style={{ padding: '7px' }} />
        <input type="text" placeholder="Posta Kodu (postalcode)" value={formData.postalcode} onChange={e => setFormData({...formData, postalcode: e.target.value})} style={{ padding: '7px' }} />
        
        <button type="submit" disabled={isSubmitting || isImporting} style={{ marginTop: '5px', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: (isSubmitting || isImporting) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
          {isSubmitting ? 'Gönderiliyor...' : 'API\'ye Gönder'}
        </button>
      </form>
    </div>
  );

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: viewMode === 3 ? '100%' : '1200px', margin: '0 auto' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
        <h2>Hoş Geldiniz, {tenantName}</h2>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', gap: '5px', backgroundColor: '#e9ecef', padding: '4px', borderRadius: '6px' }}>
            <button onClick={() => { setViewMode(1); setIsFormVisible(false); }} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: viewMode === 1 ? '#fff' : 'transparent', color: viewMode === 1 ? '#000' : '#666', border: 'none', borderRadius: '4px', cursor: 'pointer', boxShadow: viewMode === 1 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: viewMode === 1 ? 'bold' : 'normal' }}>
              1. Görünüm
            </button>
            <button onClick={() => setViewMode(2)} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: viewMode === 2 ? '#fff' : 'transparent', color: viewMode === 2 ? '#000' : '#666', border: 'none', borderRadius: '4px', cursor: 'pointer', boxShadow: viewMode === 2 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: viewMode === 2 ? 'bold' : 'normal' }}>
              2. Görünüm
            </button>
            <button onClick={() => setViewMode(3)} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: viewMode === 3 ? '#fff' : 'transparent', color: viewMode === 3 ? '#000' : '#666', border: 'none', borderRadius: '4px', cursor: 'pointer', boxShadow: viewMode === 3 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: viewMode === 3 ? 'bold' : 'normal' }}>
              3. Görünüm
            </button>
          </div>

          <span style={{ fontSize: '12px', color: '#666', backgroundColor: '#f0f0f0', padding: '4px 8px', borderRadius: '4px' }}>
            API Key: {apiKey.substring(0, 8)}...
          </span>
          <button onClick={onLogout} style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}>Çıkış Yap</button>
        </div>
      </div>
      
      {/* MAIN CONTENT AREA */}
      {viewMode === 3 ? (
        
        /* 3. GÖRÜNÜM: TAM EKRAN HARİTA VE DİNAMİK FİLTRELİ LİSTE */
        <div style={{ position: 'relative', width: '100%', minHeight: '600px', height: 'calc(100vh - 120px)', marginTop: '20px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc' }}>
          
          <MapContainer center={mapCenter} zoom={6} style={{ height: '100%', width: '100%', zIndex: 1 }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapCenterUpdater center={focusedLocation} />
            <MapResizer viewMode={viewMode} isFormVisible={isFormVisible} isListOpen={isListOpen} listWidth={listWidth} />

            {filteredNodes.map(node => (
              node.latitude && node.longitude && (
                <Marker key={node.id} position={[node.latitude, node.longitude]}>
                  <Popup>
                    <div style={{ fontSize: '12px', lineHeight: '1.4', minWidth: '180px' }}>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{node.code}</strong>
                      {node.label && <div><strong>Etiket:</strong> {node.label}</div>}
                      {node.definition && <div><strong>Açıklama:</strong> {node.definition}</div>}
                      {node.firm && <div><strong>Firma:</strong> {node.firm} {node.branch ? `(${node.branch})` : ''}</div>}
                      {node.unit && <div><strong>Birim:</strong> {node.unit}</div>}
                      {(node.address || node.city) && (
                        <div><strong>Adres:</strong> {node.address ? `${node.address}, ` : ''}{node.city} {node.postalcode ? `- ${node.postalcode}` : ''}</div>
                      )}
                      <div style={{ marginTop: '4px', fontSize: '10px', color: '#64748b', borderTop: '1px solid #eee', paddingTop: '2px' }}>
                        {new Date(node.event_date).toLocaleString('tr-TR')}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>

          {/* Harita Üstü Liste Düğmesi */}
          {!isListOpen && (
            <button 
              onClick={() => setIsListOpen(true)} 
              style={{ position: 'absolute', top: '20px', left: '70px', zIndex: 1000, padding: '10px 15px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.15)', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ☰ Listeyi Aç
            </button>
          )}

          {/* Sol Panel (Drawer) - Filtre Alanları ile Güncellendi */}
          {isListOpen && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: listWidth, height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.98)', zIndex: 1000, display: 'flex', flexDirection: 'column', boxShadow: '4px 0 15px rgba(0,0,0,0.2)', backdropFilter: 'blur(5px)', transition: 'width 0.3s ease' }}>
              
              <div style={{ padding: '12px', borderBottom: '1px solid #ddd', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#f8f9fa' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    placeholder="Ara (Kod, etiket)..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '12px' }} 
                  />
                  
                  <button 
                    onClick={() => setListWidth(prev => prev === '25%' ? '40%':'25%')} 
                    title="Genişliği Değiştir"
                    style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {listWidth === '25%' ? '>' : '<'}
                  </button>

                  <button 
                    onClick={() => setIsListOpen(false)} 
                    style={{ padding: '6px 10px', cursor: 'pointer', border: 'none', backgroundColor: '#6c757d', color: 'white', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px' }}>
                    ✕
                  </button>
                </div>

                {/* Dinamik Firma ve Şehir Filtreleri */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select 
                    value={selectedFirm} 
                    onChange={e => setSelectedFirm(e.target.value)}
                    style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '11px', backgroundColor: '#fff' }}
                  >
                    <option value="">Tüm Firmalar</option>
                    {uniqueFirms.map(firm => (
                      <option key={firm} value={firm}>{firm}</option>
                    ))}
                  </select>

                  <select 
                    value={selectedCity} 
                    onChange={e => setSelectedCity(e.target.value)}
                    style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '11px', backgroundColor: '#fff' }}
                  >
                    <option value="">Tüm Şehirler</option>
                    {uniqueCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px', display: 'flex', flexDirection: 'column' }}>
                {filteredNodes.length === 0 ? <p style={{ textAlign: 'center', color: '#666', marginTop: '20px', fontSize: '12px' }}>Kayıt bulunamadı.</p> : null}
                
                {filteredNodes.map(node => (
                  <div 
                    key={node.id} 
                    onClick={() => setFocusedLocation([node.latitude, node.longitude])}
                    style={{ 
                      padding: '8px 10px', 
                      backgroundColor: 'transparent', 
                      cursor: 'pointer', 
                      borderBottom: '1px solid #e2e8f0', 
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} 
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>
                        {node.code}
                      </span>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>
                        {new Date(node.event_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {node.label && (
                      <div style={{ fontSize: '11px', color: '#334155', fontWeight: '600' }}>
                        {node.label}
                      </div>
                    )}

                    {(node.definition || node.firm || node.city) && (
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {node.definition && <span>{node.definition}</span>}
                        {node.firm && <span>• {node.firm}</span>}
                        {node.city && <span>• {node.city}</span>}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                      <span style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {node.transaction_id}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      ) : (
        
        /* 1. VE 2. GÖRÜNÜM */
        <>
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexDirection: viewMode === 1 ? 'row' : 'column' }}>
            
            {viewMode === 1 && (
              <div style={{ flex: '1', minWidth: '300px' }}>
                {renderForm()}
              </div>
            )}

            {viewMode === 2 && isFormVisible && (
              <div style={{ maxWidth: '400px' }}>
                {renderForm()}
              </div>
            )}

            <div style={{ flex: viewMode === 1 ? '2' : 'none', width: viewMode === 1 ? 'auto' : '100%', height: viewMode === 1 ? '350px' : '450px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc' }}>
              <MapContainer center={mapCenter} zoom={6} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapCenterUpdater center={focusedLocation} />
                <MapResizer viewMode={viewMode} isFormVisible={isFormVisible} isListOpen={isListOpen} listWidth={listWidth} />

                {filteredNodes.map(node => (
                  node.latitude && node.longitude && (
                    <Marker key={node.id} position={[node.latitude, node.longitude]}>
                      <Popup>
                        <div style={{ fontSize: '12px', lineHeight: '1.4', minWidth: '180px' }}>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{node.code}</strong>
                          {node.label && <div><strong>Etiket:</strong> {node.label}</div>}
                          {node.definition && <div><strong>Açıklama:</strong> {node.definition}</div>}
                          {node.firm && <div><strong>Firma:</strong> {node.firm} {node.branch ? `(${node.branch})` : ''}</div>}
                          {node.unit && <div><strong>Birim:</strong> {node.unit}</div>}
                          {(node.address || node.city) && (
                            <div><strong>Adres:</strong> {node.address ? `${node.address}, ` : ''}{node.city} {node.postalcode ? `- ${node.postalcode}` : ''}</div>
                          )}
                          <div style={{ marginTop: '4px', fontSize: '10px', color: '#64748b', borderTop: '1px solid #eee', paddingTop: '2px' }}>
                            {new Date(node.event_date).toLocaleString('tr-TR')}
                          </div>
                        </div>
                      </Popup>
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
                
                {viewMode === 2 && (
                  <button 
                    onClick={() => setIsFormVisible(!isFormVisible)} 
                    style={{ padding: '6px 12px', backgroundColor: 'transparent', color: isFormVisible ? '#dc3545' : '#007bff', border: `1px solid ${isFormVisible ? '#dc3545' : '#007bff'}`, borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    {isFormVisible ? '✖ Formu Kapat' : '➕ Yeni Konum Ekle'}
                  </button>
                )}

                <input type="file" accept=".csv" onChange={handleImportCSV} ref={fileInputRef} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current.click()} disabled={isImporting} style={{ padding: '6px 12px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: isImporting ? 'not-allowed' : 'pointer', fontSize: '12px' }}>
                  {isImporting ? 'Yükleniyor...' : '⬆️ CSV Yükle'}
                </button>
                <button onClick={handleExportCSV} style={{ padding: '6px 12px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
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
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Etiket</th>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Firma / Şehir</th>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>İşlem ID</th>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Koordinat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNodes.map(node => (
                      <tr 
                        key={node.id} 
                        onClick={() => setFocusedLocation([node.latitude, node.longitude])} 
                        style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f1f1'} 
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '10px' }}>{new Date(node.event_date).toLocaleString('tr-TR')}</td>
                        <td style={{ padding: '10px' }}><strong>{node.code}</strong></td>
                        <td style={{ padding: '10px' }}>{node.label || '-'}</td>
                        <td style={{ padding: '10px' }}>{node.firm ? `${node.firm} / ` : ''}{node.city || '-'}</td>
                        <td style={{ padding: '10px' }}>{node.transaction_id}</td>
                        <td style={{ padding: '10px' }}>{node.latitude}, {node.longitude}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
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