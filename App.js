import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

async function recognizeFood(imageUri) {
  // Beispiel für Roboflow-API
  const apiKey = 'DEIN_ROBOFLOW_API_KEY'; // <-- eigenen Key einsetzen!
  const model = 'DEIN_MODELL'; // z.B. 'food-detection'
  const url = `https://detect.roboflow.com/${model}?api_key=${apiKey}`;

  const photo = {
    type: 'image/jpeg',
    name: 'photo.jpg',
  };

  const formData = new FormData();
  formData.append('file', photo);

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('API Fehler');
  const result = await response.json();
  return result; // Je nach API-Dokumentation anpassen!
}


const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function App() {
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [view, setView] = useState('camera'); // 'camera' | 'preview' | 'scan' | 'result'
  const [imageLoaded, setImageLoaded] = useState(false);

  const [scanResult, setScanResult] = useState(null);


  // Scan-Linien-Animation
  const lineY = useSharedValue(0);

  // Animation Style für die Linie
  const animatedLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lineY.value }],
    shadowColor: '#00e676',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 10,
  }));

  // Scan starten
  const startScan = () => {
    setView('scan');
    setImageLoaded(false); // Bild wird neu geladen
  };

  // Scan-Animation: Linie läuft 3x hoch und runter, dann Ergebnis anzeigen

  React.useEffect(() => {
    let isActive = true;
    let stopAnimation = false;
  
    async function animateScanLine() {
      const top = 0;
      const bottom = SCREEN_HEIGHT * 0.7;
      while (isActive && !stopAnimation) {
        await new Promise(resolve => {
          lineY.value = withTiming(bottom, { duration: 600 }, () => runOnJS(resolve)());
        });
        await new Promise(resolve => {
          lineY.value = withTiming(top, { duration: 600 }, () => runOnJS(resolve)());
        });
      }
    }
  
    async function doScan() {
      animateScanLine(); // Animation starten
      try {
        const result = await recognizeFood(photoUri); // KI starten
        stopAnimation = true;
        if (isActive) {
          setScanResult(result);
          setView('result');
        }
      } catch (e) {
        stopAnimation = true;
        if (isActive) {
          setScanResult(null);
          setView('result');
        }
      }
    }
  
    if (view === 'scan' && imageLoaded) {
      lineY.value = 0;
      setScanResult(null);
      doScan();
    }
  
    return () => {
      isActive = false;
      stopAnimation = true;
    };
    // eslint-disable-next-line
  }, [view, imageLoaded]);
  

  return (
    <View style={styles.container}>
      {view === 'camera' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing={facing}
            ref={cameraRef}
          />
          {/* Flip-Button */}
          <View style={styles.topButtons}>
            <TouchableOpacity style={styles.flipButton} onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}>
              <Text style={styles.flipText}>🔄</Text>
            </TouchableOpacity>
          </View>
          {/* Aufnahme-Button */}
          <View style={styles.bottomButtons}>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={async () => {
                if (cameraRef.current) {
                  const photo = await cameraRef.current.takePictureAsync();
                  setPhotoUri(photo.uri);
                  setView('preview');
                }
              }}
            >
              <View style={styles.innerCircle} />
            </TouchableOpacity>
          </View>
          <StatusBar style="auto" />
        </Animated.View>
      )}

      {view === 'preview' && photoUri && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.previewContainer}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          <View style={styles.previewButtons}>
            <TouchableOpacity style={styles.scanButton} onPress={startScan}>
              <Text style={styles.text}>Scannen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backButton} onPress={() => setView('camera')}>
              <Text style={styles.text}>Zurück zur Kamera</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {view === 'scan' && photoUri && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.previewContainer}>
          <Image
            source={{ uri: photoUri }}
            style={styles.previewImage}
            onLoadEnd={() => setImageLoaded(true)}
          />
          {imageLoaded && (
            <Animated.View style={[styles.scanLine, animatedLineStyle]} />
          )}
          <Text style={[styles.text, { marginTop: 30 }]}>Scan läuft...</Text>
        </Animated.View>
      )}

{view === 'result' && photoUri && (
  <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.previewContainer}>
    <Image source={{ uri: photoUri }} style={styles.previewImage} />
    <View style={styles.resultsContainer}>
      <Text style={styles.resultHeadline}>Erkannte Lebensmittel:</Text>
      {scanResult ? (
        <>
          {/* Beispiel Roboflow: predictions */}
          {scanResult.predictions && scanResult.predictions.length > 0 ? (
            scanResult.predictions.map((item, idx) => (
              <Text key={idx} style={styles.text}>{item.class}</Text>
            ))
          ) : (
            <Text style={styles.text}>Keine Lebensmittel erkannt</Text>
          )}
        </>
      ) : (
        <Text style={styles.text}>Scan fehlgeschlagen</Text>
      )}
    </View>
    <TouchableOpacity style={styles.backButton} onPress={() => setView('camera')}>
      <Text style={styles.text}>Zurück zur Kamera</Text>
    </TouchableOpacity>
  </Animated.View>
)}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  message: { textAlign: 'center', paddingBottom: 10, color: 'white' },
  camera: { flex: 1 },
  topButtons: {
    position: 'absolute', top: 50, left: 20, zIndex: 1,
  },
  flipButton: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 25, padding: 10,
  },
  flipText: { color: 'white', fontSize: 24 },
  bottomButtons: {
    position: 'absolute', bottom: 60, width: '100%', alignItems: 'center', justifyContent: 'center',
  },
  captureButton: {
    backgroundColor: 'white', width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: 'gray',
  },
  innerCircle: {
    backgroundColor: 'white', width: 60, height: 60, borderRadius: 30,
  },
  previewContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: '100%', height: '70%', resizeMode: 'contain', borderRadius: 20 },
  previewButtons: { flexDirection: 'row', justifyContent: 'space-evenly', marginTop: 30 },
  scanButton: { backgroundColor: '#4caf50', padding: 20, borderRadius: 10, marginHorizontal: 10 },
  backButton: { backgroundColor: '#f44336', padding: 20, borderRadius: 10, marginHorizontal: 10 },
  text: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  scanLine: {
    position: 'absolute',
    left: 30,
    right: 30,
    height: 6,
    backgroundColor: '#00e676',
    borderRadius: 3,
    opacity: 0.95,
    top: 0,
    shadowColor: '#00e676',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 10,
  },
  resultsContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 15,
    marginTop: 20,
    width: '80%',
  },
  resultHeadline: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  tableLabel: { color: '#fff', fontWeight: 'bold' },
  tableValue: { color: '#fff' },
});
