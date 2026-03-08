import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchCombined } from '../services/api';

export default function CameraScreen({ navigation }) {
  const [imageUri, setImageUri] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Request permissions and open camera ──────────────────────────────────────
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera permission is needed to scan items. Please enable it in Settings.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  // ── Open photo gallery ────────────────────────────────────────────────────────
  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Photo library permission is needed to pick images. Please enable it in Settings.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  // ── Search and navigate to results ───────────────────────────────────────────
  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      Alert.alert('Enter Item Name', 'Type the item name or brand to search sold prices.');
      return;
    }

    // Build enriched query: append serial/model number if provided
    const enrichedQuery = serialNumber.trim()
      ? `${query} ${serialNumber.trim()}`
      : query;

    setLoading(true);
    try {
      const data = await searchCombined(enrichedQuery);
      navigation.navigate('Results', {
        searchData: data,
        imageUri: imageUri,
        query: enrichedQuery,
        brand: query,
        serialNumber: serialNumber.trim(),
      });
    } catch (err) {
      Alert.alert(
        'Search Failed',
        err.message || 'Could not fetch pricing data. Check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Tagline */}
          <Text style={styles.tagline}>Scan before you spend 💸</Text>

          {/* Image Preview / Placeholder */}
          <TouchableOpacity
            style={styles.imageContainer}
            onPress={handleTakePhoto}
            activeOpacity={0.85}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.cameraIcon}>📷</Text>
                <Text style={styles.placeholderText}>Tap to take photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Gallery Picker */}
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={handlePickFromGallery}
          >
            <Text style={styles.galleryButtonText}>🖼️ Choose from Gallery</Text>
          </TouchableOpacity>

          {/* Search Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Brand / Item Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Levi's 501 jeans, Coach bag..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="next"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          {/* Serial / Model Number Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Serial / Model Number <Text style={styles.optionalLabel}>(optional)</Text></Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 00501-0193, Style #BG123..."
              placeholderTextColor="#999"
              value={serialNumber}
              onChangeText={setSerialNumber}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Text style={styles.inputHint}>Helps find exact matches on eBay & Poshmark</Text>
          </View>

          {/* NOTE: Vision AI item identification coming soon.
              For now the user types the item name/brand manually above.
              Future: send imageUri to a vision model (e.g. GPT-4o or Google Vision)
              to auto-detect brand and product type, then pre-fill the search query. */}

          {/* Search Button */}
          <TouchableOpacity
            style={[styles.searchButton, loading && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1a1a2e" size="small" />
            ) : (
              <Text style={styles.searchButtonText}>🔍 Check Sold Prices</Text>
            )}
          </TouchableOpacity>

          {loading && (
            <Text style={styles.loadingText}>Checking sold prices...</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  flex: {
    flex: 1,
  },
  container: {
    padding: 20,
    alignItems: 'center',
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  imageContainer: {
    width: '100%',
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#e0e0e0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dce3ec',
  },
  cameraIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  placeholderText: {
    color: '#555',
    fontSize: 16,
  },
  galleryButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#1a1a2e',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  galleryButtonText: {
    color: '#1a1a2e',
    fontWeight: '600',
    fontSize: 15,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a2e',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  inputHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  optionalLabel: {
    fontWeight: '400',
    color: '#999',
    fontSize: 13,
  },
  searchButton: {
    width: '100%',
    backgroundColor: '#e8c547',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  loadingText: {
    marginTop: 14,
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
});
