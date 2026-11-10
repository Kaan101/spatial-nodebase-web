import { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
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
  useEffect(() => {
    if (center) {
      map.flyTo(center, 14, { duration: 1.5 }); 
    }
  }, [center, map]);
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

function MapClickHandler({ onMapClick }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const handleClick = (e) => {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onMapClick]);
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
          style={{ padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
          required 
        />
        <button type="submit" style={{ padding: '10px', fontSize: '14px', cursor: 'pointer', backgroundColor: '#000', color: 'white', border: 'none', borderRadius: '4px' }}>
          Giriş Yap
        </button>
      </form>
      {error && <p style={{ color: 'red', marginTop: '10px', fontSize: '12px' }}>{error}</p>}
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
  const [isDrawerFormOpen, setIsDrawerFormOpen] = useState(false);
  const [isDrawerFilterOpen, setIsDrawerFilterOpen] = useState(false);
  
  const [isListOpen, setIsListOpen] = useState(false); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [selectedFirm, setSelectedFirm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(''); 
  const [listWidth, setListWidth] = useState('30%'); 

  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSearchResults, setMapSearchResults] = useState([]);
  const [pinnedLocation, setPinnedLocation] = useState(null);

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

  const [filterData, setFilterData] = useState({
    code: '', 
    label: '', 
    definition: '',
    transaction_id: '',
    unit: '',
    firm: '',
    branch: '',
    latitude: '', 
    longitude: '',
    country: '',
    region: '',
    city: '',
    address: '',
    postalcode: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const isFilterFilled = Object.values(filterData).some(val => val !== '' && val !== null && val !== undefined) 
                         || selectedFirm !== '' || selectedCity !== '' || selectedVehicle !== '';

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

  useEffect(() => {
    if (mapSearchQuery.length < 3) {
      setMapSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}&countrycodes=tr&addressdetails=1&limit=6`);
        setMapSearchResults(res.data);
      } catch (err) {
        console.error("Arama servisi hatası:", err);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [mapSearchQuery]);

  const handleSelectLocation = async (lat, lon, displayName = '', addressObj = {}) => {
    const newCoords = [parseFloat(lat), parseFloat(lon)];
    setPinnedLocation(newCoords);
    setFocusedLocation(newCoords);
    setMapSearchResults([]);
    setMapSearchQuery(displayName);

    const cityVal = addressObj.province || addressObj.city || addressObj.state || addressObj.town || '';
    const regionVal = addressObj.region || '';
    const postcodeVal = addressObj.postcode || '';
    const countryVal = addressObj.country || 'Türkiye';

    setFormData(prev => ({
      ...prev,
      latitude: newCoords[0],
      longitude: newCoords[1],
      city: cityVal || prev.city,
      region: regionVal || prev.region,
      country: countryVal,
      address: displayName || prev.address,
      postalcode: postcodeVal || prev.postalcode
    }));
  };

  const handleMapClickSelection = async (lat, lon) => {
    const newCoords = [parseFloat(lat), parseFloat(lon)];
    setPinnedLocation(newCoords);
    setFocusedLocation(newCoords);

    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`);
      const addr = res.data.address || {};
      const fullAddr = res.data.display_name || 'İşaretlenen Konum';
      
      const cityVal = addr.province || addr.city || addr.state || addr.town || '';
      const regionVal = addr.region || '';
      
      setMapSearchQuery(fullAddr);
      setFormData(prev => ({
        ...prev,
        latitude: newCoords[0],
        longitude: newCoords[1],
        city: cityVal || prev.city,
        region: regionVal || prev.region,
        country: addr.country || 'Türkiye',
        address: fullAddr,
        postalcode: addr.postcode || prev.postalcode
      }));
    } catch (err) {
      setFormData(prev => ({
        ...prev,
        latitude: newCoords[0],
        longitude: newCoords[1],
        address: 'Özel İşaretlenen Konum'
      }));
    }
  };

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
      setIsDrawerFormOpen(false); 
      setPinnedLocation(null);
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

  const uniqueFirms = [...new Set(nodes.map(n => n.firm).filter(Boolean))];
  const uniqueCities = [...new Set(nodes.map(n => n.city).filter(Boolean))];
  const uniqueVehicles = [...new Set(nodes.map(n => n.code).filter(Boolean))];

  const filteredNodes = nodes.filter(node => {
    const matchesSearch = 
      node.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (node.label && node.label.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (node.city && node.city.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFirm = selectedFirm ? node.firm === selectedFirm : true;
    const matchesCity = selectedCity ? node.city === selectedCity : true;

    const matchCode = filterData.code ? node.code.toLowerCase().includes(filterData.code.toLowerCase()) : true;
    const matchLabel = filterData.label ? (node.label && node.label.toLowerCase().includes(filterData.label.toLowerCase())) : true;
    const matchDef = filterData.definition ? (node.definition && node.definition.toLowerCase().includes(filterData.definition.toLowerCase())) : true;
    const matchTxn = filterData.transaction_id ? (node.transaction_id && node.transaction_id.toLowerCase().includes(filterData.transaction_id.toLowerCase())) : true;
    const matchUnit = filterData.unit ? (node.unit && node.unit.toLowerCase().includes(filterData.unit.toLowerCase())) : true;
    const matchFirmInput = filterData.firm ? (node.firm && node.firm.toLowerCase().includes(filterData.firm.toLowerCase())) : true;
    const matchBranch = filterData.branch ? (node.branch && node.branch.toLowerCase().includes(filterData.branch.toLowerCase())) : true;
    const matchCountry = filterData.country ? (node.country && node.country.toLowerCase().includes(filterData.country.toLowerCase())) : true;
    const matchRegion = filterData.region ? (node.region && node.region.toLowerCase().includes(filterData.region.toLowerCase())) : true;
    const matchCityInput = filterData.city ? (node.city && node.city.toLowerCase().includes(filterData.city.toLowerCase())) : true;
    const matchAddress = filterData.address ? (node.address && node.address.toLowerCase().includes(filterData.address.toLowerCase())) : true;
    const matchPost = filterData.postalcode ? (node.postalcode && node.postalcode.toLowerCase().includes(filterData.postalcode.toLowerCase())) : true;

    return matchesSearch && matchesFirm && matchesCity && matchCode && matchLabel && matchDef && matchTxn && matchUnit && matchFirmInput && matchBranch && matchCountry && matchRegion && matchCityInput && matchAddress && matchPost;
  });

  const vehicleRouteCoordinates = selectedVehicle 
    ? nodes
        .filter(n => n.code === selectedVehicle && n.latitude && n.longitude)
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
        .map(n => [n.latitude, n.longitude])
    : [];

  const defaultCenter = [41.0082, 28.9784];

  const formatFriendlyDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const fullDateStr = date.toLocaleDateString('tr-TR');

    if (isToday) return `Bugün, ${timeStr}`;
    if (isYesterday) return `Dün, ${timeStr}`;
    return `${fullDateStr} ${timeStr}`;
  };

  const renderForm = () => (
    <div style={{ padding: '16px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '11px', textAlign: 'left' }}>
      <h4 style={{ marginTop: '0', fontSize: '13px', marginBottom: '8px' }}>Yeni Konum ve Detay Ekle</h4>
      <form onSubmit={handleAddNode} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <input type="text" placeholder="Araç/Cihaz Kodu *" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} required />
        <input type="text" placeholder="Serbest Metin / Etiket (label)" value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Detaylı Tanım (definition)" value={formData.definition} onChange={e => setFormData({...formData, definition: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="İşlem veya Sinyal Takip ID" value={formData.transaction_id} onChange={e => setFormData({...formData, transaction_id: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Birim Bilgisi (unit)" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Kurum veya Firma Adı (firm)" value={formData.firm} onChange={e => setFormData({...formData, firm: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Şube veya Departman (branch)" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="number" step="any" placeholder="Enlem (Latitude) *" value={formData.latitude} onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})} style={{ padding: '5px', fontSize: '11px' }} required />
        <input type="number" step="any" placeholder="Boylam (Longitude) *" value={formData.longitude} onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})} style={{ padding: '5px', fontSize: '11px' }} required />
        <input type="text" placeholder="Ülke Bilgisi (country)" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Bölge Bilgisi (region)" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Şehir Bilgisi (city)" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Açık Adres (address)" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Posta Kodu (postalcode)" value={formData.postalcode} onChange={e => setFormData({...formData, postalcode: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        
        <button type="submit" disabled={isSubmitting || isImporting} style={{ marginTop: '4px', padding: '8px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '4px', cursor: (isSubmitting || isImporting) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '11px' }}>
          {isSubmitting ? 'Gönderiliyor...' : 'API\'ye Gönder'}
        </button>
      </form>
    </div>
  );

  const renderFilterForm = () => (
    <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #1a73e8', boxSizing: 'border-box', fontSize: '11px', textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, color: '#1a73e8', fontSize: '13px' }}>Gelişmiş Filtrele</h4>
        <button 
          onClick={() => {
            setFilterData({ code: '', label: '', definition: '', transaction_id: '', unit: '', firm: '', branch: '', latitude: '', longitude: '', country: '', region: '', city: '', address: '', postalcode: '' });
            setSelectedFirm('');
            setSelectedCity('');
            setSelectedVehicle('');
          }}
          style={{ fontSize: '10px', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Filtreleri Temizle
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #ddd' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <select 
            value={selectedFirm} 
            onChange={e => setSelectedFirm(e.target.value)}
            style={{ flex: 1, minWidth: '100px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '11px', backgroundColor: '#fff' }}
          >
            <option value="">Tüm Firmalar</option>
            {uniqueFirms.map(firm => (
              <option key={firm} value={firm}>{firm}</option>
            ))}
          </select>

          <select 
            value={selectedCity} 
            onChange={e => setSelectedCity(e.target.value)}
            style={{ flex: 1, minWidth: '100px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '11px', backgroundColor: '#fff' }}
          >
            <option value="">Tüm Şehirler</option>
            {uniqueCities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        <select 
          value={selectedVehicle} 
          onChange={e => setSelectedVehicle(e.target.value)}
          style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #1a73e8', fontSize: '11px', backgroundColor: '#e8f0fe', fontWeight: 'bold', color: '#1a73e8' }}
        >
          <option value="">🗺️ Rota Çizmek İçin Araç Seçin</option>
          {uniqueVehicles.map(veh => (
            <option key={veh} value={veh}>Araç Rotası: {veh}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <input type="text" placeholder="Araç/Cihaz Kodu filtrele..." value={filterData.code} onChange={e => setFilterData({...filterData, code: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Etiket filtrele..." value={filterData.label} onChange={e => setFilterData({...filterData, label: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Detaylı Tanım filtrele..." value={filterData.definition} onChange={e => setFilterData({...filterData, definition: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="İşlem ID filtrele..." value={filterData.transaction_id} onChange={e => setFilterData({...filterData, transaction_id: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Birim filtrele..." value={filterData.unit} onChange={e => setFilterData({...filterData, unit: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Firma filtrele..." value={filterData.firm} onChange={e => setFilterData({...filterData, firm: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Şube filtrele..." value={filterData.branch} onChange={e => setFilterData({...filterData, branch: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Ülke filtrele..." value={filterData.country} onChange={e => setFilterData({...filterData, country: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Bölge filtrele..." value={filterData.region} onChange={e => setFilterData({...filterData, region: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Şehir filtrele..." value={filterData.city} onChange={e => setFilterData({...filterData, city: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Adres filtrele..." value={filterData.address} onChange={e => setFilterData({...filterData, address: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
        <input type="text" placeholder="Posta Kodu filtrele..." value={filterData.postalcode} onChange={e => setFilterData({...filterData, postalcode: e.target.value})} style={{ padding: '5px', fontSize: '11px' }} />
      </div>
    </div>
  );

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', width: '90%', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
        <h2 style={{ fontSize: '18px', margin: 0 }}>Hoş Geldiniz, {tenantName}</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#e9ecef', padding: '3px', borderRadius: '6px' }}>
            <button onClick={() => { setViewMode(1); setIsFormVisible(false); }} style={{ padding: '5px 10px', fontSize: '11px', backgroundColor: viewMode === 1 ? '#fff' : 'transparent', color: viewMode === 1 ? '#000' : '#666', border: 'none', borderRadius: '4px', cursor: 'pointer', boxShadow: viewMode === 1 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: viewMode === 1 ? 'bold' : 'normal' }}>
              1. Görünüm
            </button>
            <button onClick={() => setViewMode(2)} style={{ padding: '5px 10px', fontSize: '11px', backgroundColor: viewMode === 2 ? '#fff' : 'transparent', color: viewMode === 2 ? '#000' : '#666', border: 'none', borderRadius: '4px', cursor: 'pointer', boxShadow: viewMode === 2 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: viewMode === 2 ? 'bold' : 'normal' }}>
              2. Görünüm
            </button>
            <button onClick={() => setViewMode(3)} style={{ padding: '5px 10px', fontSize: '11px', backgroundColor: viewMode === 3 ? '#fff' : 'transparent', color: viewMode === 3 ? '#000' : '#666', border: 'none', borderRadius: '4px', cursor: 'pointer', boxShadow: viewMode === 3 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: viewMode === 3 ? 'bold' : 'normal' }}>
              3. Görünüm
            </button>
          </div>

          <span style={{ fontSize: '11px', color: '#666', backgroundColor: '#f0f0f0', padding: '4px 8px', borderRadius: '4px' }}>
            API Key: {apiKey.substring(0, 8)}...
          </span>
          <button onClick={onLogout} style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px' }}>Çıkış Yap</button>
        </div>
      </div>
      
      {/* MAIN CONTENT AREA */}
      {viewMode === 3 ? (
        
        /* 3. GÖRÜNÜM */
        <div style={{ position: 'relative', width: '100%', minHeight: '600px', height: 'calc(100vh - 120px)', marginTop: '20px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc' }}>
          
          <MapContainer center={defaultCenter} zoom={6} style={{ height: '100%', width: '100%', zIndex: 1 }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapCenterUpdater center={focusedLocation} />
            <MapResizer viewMode={viewMode} isFormVisible={isFormVisible} isListOpen={isListOpen} listWidth={listWidth} />
            <MapClickHandler onMapClick={(coords) => handleMapClickSelection(coords[0], coords[1])} />

            {pinnedLocation && (
              <Marker position={pinnedLocation}>
                <Popup>Seçilen Konum (Form Alanları Dolduruldu)</Popup>
              </Marker>
            )}

            {vehicleRouteCoordinates.length > 1 && (
              <Polyline positions={vehicleRouteCoordinates} color="#1a73e8" weight={4} opacity={0.8} />
            )}

            <MarkerClusterGroup chunkedLoading>
              {filteredNodes.map(node => (
                node.latitude && node.longitude && (
                  <Marker key={node.id} position={[node.latitude, node.longitude]}>
                    <Popup>
                      <div style={{ fontSize: '11px', lineHeight: '1.3', minWidth: '160px' }}>
                        <strong style={{ fontSize: '12px', color: '#0f172a' }}>{node.code}</strong>
                        {node.label && <div><strong>Etiket:</strong> {node.label}</div>}
                        {node.definition && <div><strong>Açıklama:</strong> {node.definition}</div>}
                        {node.firm && <div><strong>Firma:</strong> {node.firm} {node.branch ? `(${node.branch})` : ''}</div>}
                        {node.unit && <div><strong>Birim:</strong> {node.unit}</div>}
                        {(node.address || node.city) && (
                          <div><strong>Adres:</strong> {node.address ? `${node.address}, ` : ''}{node.city} {node.postalcode ? `- ${node.postalcode}` : ''}</div>
                        )}
                        <div style={{ marginTop: '4px', fontSize: '9px', color: '#64748b', borderTop: '1px solid #eee', paddingTop: '2px' }}>
                          {formatFriendlyDate(node.event_date)}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}
            </MarkerClusterGroup>
          </MapContainer>

          <div style={{ position: 'absolute', top: '20px', left: '75px', right: '110px', zIndex: 1000, maxWidth: '380px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dfe1e5', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', padding: '0 12px', height: '48px' }}>
              
              <button 
                onClick={() => setIsListOpen(!isListOpen)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', marginRight: '8px', display: 'flex', alignItems: 'center' }}
                title="Menüyü Aç/Kapat"
              >
                <span style={{ fontSize: '16px', color: '#5f6368', fontWeight: 'bold' }}>☰</span>
              </button>

              <input 
                type="text"
                placeholder="Google Haritalar'da ara"
                value={mapSearchQuery}
                onChange={e => setMapSearchQuery(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', fontWeight: 'bold', backgroundColor: 'transparent', color: '#202124' }}
              />

              {mapSearchQuery && (
                <button 
                  onClick={() => { setMapSearchQuery(''); setMapSearchResults([]); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#70757a', padding: '0 6px' }}
                  title="Temizle"
                >
                  ✕
                </button>
              )}
            </div>

            {mapSearchResults.length > 0 && (
              <div style={{ backgroundColor: '#fff', border: '1px solid #dfe1e5', borderRadius: '0 0 8px 8px', marginTop: '2px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: '350px', overflowY: 'auto' }}>
                {mapSearchResults.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleSelectLocation(item.lat, item.lon, item.display_name, item.address)}
                    style={{ padding: '10px 14px', fontSize: '12px', borderBottom: '1px solid #f1f3f4', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '10px' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    <span style={{ fontSize: '14px', marginTop: '2px' }}>🕒</span>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <span style={{ fontWeight: '600', color: '#202124' }}>{item.display_name.split(',')[0]}</span>
                      <span style={{ fontSize: '11px', color: '#70757a', marginTop: '2px' }}>{item.display_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sağ Tarafta Drawer */}
          {isListOpen && (
            <div style={{ position: 'absolute', top: 0, right: 0, width: listWidth, height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.98)', zIndex: 1000, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 15px rgba(0,0,0,0.2)', backdropFilter: 'blur(5px)', transition: 'width 0.3s ease' }}>
              
              <div style={{ padding: '10px', borderBottom: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#fff' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  
                  {/* İkonu kaldırılmış, Dolgusuz Şeffaf Arama Çubuğu */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', backgroundColor: 'transparent', borderRadius: '4px', padding: '0 8px', border: '1px solid #ccc' }}>
                    <input 
                      type="text" 
                      placeholder="Listede ara..." 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                      style={{ flex: 1, padding: '7px 4px', border: 'none', outline: 'none', fontSize: '11px', backgroundColor: 'transparent', color: '#202124' }} 
                    />
                  </div>
                  
                  {/* Genişletme Daraltma Butonu */}
                  <button 
                    onClick={() => setListWidth(prev => prev === '30%' ? '45%':'30%')} 
                    title="Genişliği Değiştir"
                    style={{ padding: '5px 8px', fontSize: '11px', backgroundColor: '#f1f3f4', border: '1px solid #dadce0', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#3c4043' }}>
                    {listWidth === '30%' ? '<' : '>'}
                  </button>
                  
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch', width: '100%', marginTop: '2px' }}>
                  
                  {/* Geniş Ekle / İptal Butonu (İptal durumunda gri outline olur) */}
                  <button 
                    onClick={() => { setIsDrawerFormOpen(!isDrawerFormOpen); setIsDrawerFilterOpen(false); }}
                    style={{ 
                      flex: 1,
                      padding: '6px', 
                      backgroundColor: isDrawerFormOpen ? 'transparent' : '#e6f4ea', 
                      color: isDrawerFormOpen ? '#5f6368' : '#137333', 
                      border: isDrawerFormOpen ? '1px solid #5f6368' : '1px solid #137333', 
                      borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' 
                    }}
                  >
                    {isDrawerFormOpen ? '✖ İptal' : 'Ekle'}
                  </button>

                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {/* Tamamen Dolgusuz (Açık Gri / Mavi) Geniş Outline Filter Butonu */}
                    <button 
                      onClick={() => { setIsDrawerFilterOpen(!isDrawerFilterOpen); setIsDrawerFormOpen(false); }}
                      style={{ 
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '4px 6px', 
                        backgroundColor: 'transparent', 
                        color: (isDrawerFilterOpen && isFilterFilled) ? '#1a73e8' : '#5f6368', 
                        border: `1px solid ${(isDrawerFilterOpen && isFilterFilled) ? '#1a73e8' : '#ccc'}`, 
                        borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' 
                      }}
                    >
                      <span>{isDrawerFilterOpen ? (isFilterFilled ? 'Uygula' : '✖ Kapat') : 'Filter'}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '16px', height: '16px', padding: '0 4px', backgroundColor: '#e8f0fe', color: '#1a73e8', borderRadius: '8px', fontSize: '9px', fontWeight: 'bold', border: '1px solid #d2e3fc' }}>
                        {filteredNodes.length}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sola Dayalı 3 Satırlı Ultra Kompakt İkonsuz Liste Görünümü */}
              <div style={{ flex: 1, overflowY: 'auto', padding: (isDrawerFormOpen || isDrawerFilterOpen) ? '10px' : '0', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
                {isDrawerFormOpen ? (
                  renderForm()
                ) : isDrawerFilterOpen ? (
                  renderFilterForm()
                ) : (
                  <>
                    {filteredNodes.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#70757a', marginTop: '40px', fontSize: '11px' }}>Kayıt bulunamadı.</div>
                    ) : null}
                    
                    {filteredNodes.map(node => (
                      <div 
                        key={node.id} 
                        onClick={() => setFocusedLocation([node.latitude, node.longitude])}
                        style={{ 
                          padding: '8px 12px', 
                          backgroundColor: '#fff', 
                          cursor: 'pointer', 
                          borderBottom: '1px solid #f1f3f4', 
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'} 
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                      >
                        {/* Satır 1: Başlık ve Tarih */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%' }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#202124', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>
                            {node.code} {node.label ? `- ${node.label}` : ''}
                          </span>
                          <span style={{ fontSize: '9px', color: '#5f6368', flexShrink: 0, marginLeft: '8px', textAlign: 'right' }}>
                            {formatFriendlyDate(node.event_date)}
                          </span>
                        </div>

                        {/* Satır 2: Konum Bilgileri */}
                        <div style={{ 
                          fontSize: '9px', 
                          color: '#70757a', 
                          lineHeight: '1.2', 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          textAlign: 'left'
                        }}>
                          {[
                            node.city,
                            node.postalcode && `PK: ${node.postalcode}`,
                            node.address
                          ].filter(Boolean).join(' • ')}
                        </div>

                        {/* Satır 3: Kurum ve İşlem Bilgileri */}
                        <div style={{ 
                          fontSize: '9px', 
                          color: '#70757a', 
                          lineHeight: '1.2', 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          textAlign: 'left'
                        }}>
                          {[
                            node.firm && `${node.firm}${node.branch ? ` (${node.branch})` : ''}`,
                            node.transaction_id && `ID: ${node.transaction_id}`
                          ].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    ))}
                  </>
                )}
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

            <div style={{ flex: viewMode === 1 ? '2' : 'none', width: viewMode === 1 ? 'auto' : '100%', height: '620px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc' }}>
              <MapContainer center={defaultCenter} zoom={6} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapCenterUpdater center={focusedLocation} />
                <MapResizer viewMode={viewMode} isFormVisible={isFormVisible} isListOpen={isListOpen} listWidth={listWidth} />
                <MapClickHandler onMapClick={(coords) => handleMapClickSelection(coords[0], coords[1])} />

                {pinnedLocation && (
                  <Marker position={pinnedLocation}>
                    <Popup>Seçilen Konum (Form Alanları Dolduruldu)</Popup>
                  </Marker>
                )}

                {vehicleRouteCoordinates.length > 1 && (
                  <Polyline positions={vehicleRouteCoordinates} color="#1a73e8" weight={4} opacity={0.8} />
                )}

                <MarkerClusterGroup chunkedLoading>
                  {filteredNodes.map(node => (
                    node.latitude && node.longitude && (
                      <Marker key={node.id} position={[node.latitude, node.longitude]}>
                        <Popup>
                          <div style={{ fontSize: '11px', lineHeight: '1.3', minWidth: '160px' }}>
                            <strong style={{ fontSize: '12px', color: '#0f172a' }}>{node.code}</strong>
                            {node.label && <div><strong>Etiket:</strong> {node.label}</div>}
                            {node.definition && <div><strong>Açıklama:</strong> {node.definition}</div>}
                            {node.firm && <div><strong>Firma:</strong> {node.firm} {node.branch ? `(${node.branch})` : ''}</div>}
                            {node.unit && <div><strong>Birim:</strong> {node.unit}</div>}
                            {(node.address || node.city) && (
                              <div><strong>Adres:</strong> {node.address ? `${node.address}, ` : ''}{node.city} {node.postalcode ? `- ${node.postalcode}` : ''}</div>
                            )}
                            <div style={{ marginTop: '4px', fontSize: '9px', color: '#64748b', borderTop: '1px solid #eee', paddingTop: '2px' }}>
                              {formatFriendlyDate(node.event_date)}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    )
                  ))}
                </MarkerClusterGroup>
              </MapContainer>
            </div>
          </div>

          <div style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', margin: 0 }}>Son Konum ve İşlem Verileri</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                
                {viewMode === 2 && (
                  <button 
                    onClick={() => setIsFormVisible(!isFormVisible)} 
                    style={{ padding: '5px 10px', backgroundColor: 'transparent', color: isFormVisible ? '#dc3545' : '#1a73e8', border: `1px solid ${isFormVisible ? '#dc3545' : '#1a73e8'}`, borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                    {isFormVisible ? '✖ Formu Kapat' : 'Ekle'}
                  </button>
                )}

                <input type="file" accept=".csv" onChange={handleImportCSV} ref={fileInputRef} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current.click()} disabled={isImporting} style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: isImporting ? 'not-allowed' : 'pointer', fontSize: '11px' }}>
                  {isImporting ? 'Yükleniyor...' : '⬆️ CSV Yükle'}
                </button>
                <button onClick={handleExportCSV} style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                  ⬇️ CSV İndir
                </button>
              </div>
            </div>
            
            {loading ? <p style={{ fontSize: '11px' }}>Yükleniyor...</p> : nodes.length === 0 ? <p style={{ fontSize: '11px' }}>Kayıt yok.</p> : (
              <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontSize: '10px', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                      <th style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>Tarih</th>
                      <th style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>Kod</th>
                      <th style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>Etiket</th>
                      <th style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>Firma / Şehir</th>
                      <th style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>İşlem ID</th>
                      <th style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>Koordinat</th>
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
                        <td style={{ padding: '8px' }}>{formatFriendlyDate(node.event_date)}</td>
                        <td style={{ padding: '8px' }}><strong>{node.code}</strong></td>
                        <td style={{ padding: '8px' }}>{node.label || '-'}</td>
                        <td style={{ padding: '8px' }}>{node.firm ? `${node.firm} / ` : ''}{node.city || '-'}</td>
                        <td style={{ padding: '8px' }}>{node.transaction_id}</td>
                        <td style={{ padding: '8px' }}>{node.latitude}, {node.longitude}</td>
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