import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

const theme = {
  bg: '#0e0f13', card: '#171a21', border:'#252a36', text:'#eef1f8', muted:'#a9b0bf', acc:'#4f8cff', ok:'#29c76f', mid:'#11c5c6'
};

export default function PlannerScreen(){
  const [address, setAddress] = useState('');
  const [stops, setStops] = useState([]); // {id,address,lat,lon,delivered}
  const [routeCoords, setRouteCoords] = useState([]);
  const mapRef = useRef(null);

  async function geocode(q){
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {headers:{'Accept-Language':'pt-BR','User-Agent':'RotaMax/1.0 (expo)'}});
    if(!res.ok) throw new Error('Falha no geocoding');
    const data = await res.json();
    if(!data.length) throw new Error('Endereço não encontrado');
    const {lat, lon, display_name} = data[0];
    return {lat:parseFloat(lat), lon:parseFloat(lon), display_name};
  }

  const addStop = async () => {
    const t = address.trim(); if(!t) return;
    try{
      const g = await geocode(t);
      const item = { id: Math.random().toString(36).slice(2), address: g.display_name, lat: g.lat, lon: g.lon, delivered:false };
      const next = [...stops, item];
      setStops(next);
      fitMarkers(next);
      setAddress('');
    }catch(e){ Alert.alert('Erro', e.message || 'Erro ao adicionar'); }
  };

  const useGPS = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão negada','Habilite o GPS para usar sua localização'); return; }
    const pos = await Location.getCurrentPositionAsync({});
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    let label = 'Minha localização';
    try{
      const rev = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      if(rev.ok){ const dj = await rev.json(); label = dj.display_name || label; }
    }catch{}
    const next = [{ id: Math.random().toString(36).slice(2), address: label, lat, lon, delivered:false }, ...stops];
    setStops(next);
    fitMarkers(next);
  };

  const fitMarkers = (arr=stops) => {
    if(!mapRef.current || !arr.length) return;
    const coords = arr.filter(s => s.lat && s.lon).map(s => ({ latitude: s.lat, longitude: s.lon }));
    if(coords.length){
      mapRef.current.fitToCoordinates(coords, { edgePadding: { top:80, bottom:80, left:80, right:80 }, animated: true });
    }
  };

  const clearAll = () => { setStops([]); setRouteCoords([]); };

  const moveUp = (idx) => {
    if(idx<=0) return;
    const a = [...stops];
    [a[idx-1], a[idx]] = [a[idx], a[idx-1]];
    setStops(a); setRouteCoords([]);
  };
  const moveDown = (idx) => {
    if(idx>=stops.length-1) return;
    const a = [...stops];
    [a[idx+1], a[idx]] = [a[idx], a[idx+1]];
    setStops(a); setRouteCoords([]);
  };
  const removeAt = (idx) => {
    const a = [...stops]; a.splice(idx,1); setStops(a); setRouteCoords([]);
  };
  const toggleDelivered = (idx) => {
    const a = [...stops]; a[idx].delivered = !a[idx].delivered; setStops(a);
  };

  // OSRM Trip optimization
  async function optimize(){
    if(stops.length < 3){ Alert.alert('Aviso','Adicione 3+ endereços'); return; }
    const coords = stops.map(s => `${s.lon},${s.lat}`).join(';');
    const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?roundtrip=true&source=first&destination=last&overview=full&geometries=geojson`;
    const res = await fetch(url);
    if(!res.ok){ Alert.alert('OSRM','Indisponível agora'); return; }
    const data = await res.json();
    if(data.code !== 'Ok'){ Alert.alert('OSRM','Falha ao otimizar'); return; }
    const order = data.trips[0].waypoints.map(w=>w.waypoint_index);
    const reord = order.map(i => stops[i]);
    setStops(reord);
    setRouteCoords(data.trips[0].geometry.coordinates.map(([lon,lat]) => ({latitude:lat, longitude:lon})));
    fitMarkers(reord);
  }

  async function route(){
    if(stops.length < 2){ Alert.alert('Aviso','Adicione 2+ endereços'); return; }
    const coords = stops.map(s => `${s.lon},${s.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if(!res.ok){ Alert.alert('OSRM','Indisponível'); return; }
    const data = await res.json();
    if(data.code !== 'Ok'){ Alert.alert('OSRM','Falha ao traçar rota'); return; }
    setRouteCoords(data.routes[0].geometry.coordinates.map(([lon,lat]) => ({latitude:lat, longitude:lon})));
    fitMarkers(stops);
  }

  const renderItem = ({item, index}) => (
    <View style={[styles.item, {opacity:item.delivered?0.6:1}]}>
      <View style={[styles.badge,{backgroundColor:index===0?theme.acc:(index===stops.length-1?theme.ok:theme.mid)}]}>
        <Text style={{color:'#fff',fontWeight:'800'}}>{index+1}</Text>
      </View>
      <View style={{flex:1}}>
        <Text style={styles.addr} numberOfLines={2}>{item.address}</Text>
        <View style={styles.miniRow}>
          <Btn outline title="↑" onPress={()=>moveUp(index)} />
          <Btn outline title="↓" onPress={()=>moveDown(index)} />
          <Btn outline title={item.delivered?'Desmarcar':'Entregue'} onPress={()=>toggleDelivered(index)} />
          <Btn outline title="Remover" onPress={()=>removeAt(index)} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={{flex:1, backgroundColor: theme.bg}}>
      <View style={styles.top}>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Adicionar endereço (ex.: Av. Paulista, 1000, São Paulo)"
          placeholderTextColor="#7f8798"
          style={styles.input}
        />
        <Btn title="Adicionar" onPress={addStop} />
      </View>
      <View style={styles.top2}>
        <Btn outline title="Usar minha localização" onPress={useGPS} />
        <Btn warn title="Limpar" onPress={clearAll} />
      </View>

      <View style={{flex:1}}>
        <MapView
          ref={mapRef}
          style={{flex:1}}
          initialRegion={{ latitude:-23.5505, longitude:-46.6333, latitudeDelta:0.2, longitudeDelta:0.2 }}
          showsUserLocation
        >
          {stops.map((s,idx)=> (
            <Marker key={s.id} coordinate={{latitude:s.lat, longitude:s.lon}} title={`${idx+1}. ${s.address}`} pinColor={idx===0?theme.acc:(idx===stops.length-1?theme.ok:theme.mid)} />
          ))}
          {routeCoords.length>0 && <Polyline coordinates={routeCoords} strokeWidth={5} />}
        </MapView>
      </View>

      <View style={styles.actions}>
        <Btn ok title="Otimizar rota" onPress={optimize} />
        <Btn title="Traçar rota" onPress={route} />
      </View>

      <FlatList
        data={stops}
        keyExtractor={(i)=>i.id}
        renderItem={renderItem}
        style={{maxHeight:260, backgroundColor:theme.card, borderTopWidth:1, borderColor:theme.border}}
      />
    </View>
  );
}

function Btn({title,onPress,outline,ok,warn}){
  const base = [styles.btn];
  if(outline) base.push(styles.btnOutline);
  if(ok) base.push({backgroundColor:theme.ok});
  if(warn) base.push({backgroundColor:'#ffb020'});
  return (
    <TouchableOpacity style={base} onPress={onPress}>
      <Text style={{color:'#fff',fontWeight:'700'}}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  top:{flexDirection:'row',gap:8,padding:10,backgroundColor:'#171a21',borderBottomWidth:1,borderColor:'#252a36'},
  top2:{flexDirection:'row',gap:8,paddingHorizontal:10,paddingBottom:10,backgroundColor:'#171a21'},
  input:{flex:1,backgroundColor:'#0f1219',color:'#eef1f8',borderWidth:1,borderColor:'#2a3040',borderRadius:12,paddingHorizontal:12,paddingVertical:10},
  btn:{backgroundColor:'#4f8cff',borderRadius:12,paddingVertical:12,paddingHorizontal:14,alignItems:'center',justifyContent:'center'},
  btnOutline:{backgroundColor:'transparent',borderWidth:1,borderColor:'#3a4154'},
  actions:{flexDirection:'row',gap:8,padding:10,backgroundColor:'#171a21',borderTopWidth:1,borderColor:'#252a36'},
  item:{flexDirection:'row',gap:8,alignItems:'center',padding:10,borderBottomWidth:1,borderColor:'#252a36'},
  badge:{width:28,height:28,borderRadius:8,alignItems:'center',justifyContent:'center'},
  addr:{color:'#cfd5e6',fontSize:13}
});