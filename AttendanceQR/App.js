import React, { useRef } from 'react';
import { StyleSheet, SafeAreaView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

export default function App() {
  const webviewRef = useRef(null);

  // 1. Your Injected JS: Declares the bridge inside the web app before it loads
  const injectedJavaScript = `
    window.nativeBridge = {
      checkMockLocation: function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CHECK_MOCK_LOCATION'
        }));
      },
    };

    // Listens for replies from native side
    document.addEventListener('message', function(e) {
      try {
        var data = JSON.parse(e.data);
        var event = new CustomEvent('nativeBridgeMessage', { detail: data });
        window.dispatchEvent(event);
      } catch (err) {
        console.error("Bridge parse error:", err);
      }
    });
    true; // Note: safe requirement for injectedJavaScript in react-native-webview
  `;

  // 2. Your Native Handler: Receives the web app's message, checks GPS, and replies
  const handleMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'CHECK_MOCK_LOCATION') {
        let isMocked = false;

        if (Platform.OS === 'android') {
          // Request permission on the fly if not already granted
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({ 
              accuracy: Location.Accuracy.Balanced 
            });
            isMocked = (location.mocked === true); // Android-only hardware flag
          }
        }

        // Construct the payload matching your web-app/src/utils/mockLocation.ts structure
        const responsePayload = JSON.stringify({
          type: 'MOCK_LOCATION_RESULT',
          isMocked: isMocked
        });

        // Inject result back into WebView as a DOM event
        const jsInject = `
          window.postMessage(${responsePayload}, '*');
          document.dispatchEvent(new MessageEvent('message', { data: ${responsePayload} }));
        `;
        webviewRef.current?.injectJavaScript(jsInject);
      }
    } catch (error) {
      console.error("Native handler error:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ uri: 'https://attendancemaker-tsjz.onrender.com' }}
        injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});