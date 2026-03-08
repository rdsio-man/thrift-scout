import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import { createItem } from '../services/api';

const PRODUCT_TYPES = [
  'Dress',
  'Shoes',
  'Tops',
  'Bottoms',
  'Jacket',
  'Jeans',
  'Accessories',
  'Bags',
  'Other',
];

function getTodayString() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

export default function ConfirmPurchaseScreen({ route, navigation }) {
  const { imageUri, query, suggestedPrice } = route.params || {};

  // ── Form state ───────────────────────────────────────────────────────────────
  const [brand, setBrand] = useState(query || '');
  const [productType, setProductType] = useState('Other');
  const [description, setDescription] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(getTodayString());
  const [purchasedAt, setPurchasedAt] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!brand.trim() && !description.trim()) {
      Alert.alert('Required Fields', 'Please enter a brand or description before saving.');
      return;
    }

    setSaving(true);
    try {
      // Convert local image to base64 for upload
      let imageBase64 = undefined;
      if (imageUri) {
        try {
          imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (imgErr) {
          console.warn('[ConfirmPurchase] Could not read image file:', imgErr.message);
        }
      }

      const payload = {
        brand: brand.trim() || undefined,
        productType: productType || undefined,
        description: description.trim() || undefined,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
        purchaseDate: purchaseDate || undefined,
        purchasedAt: purchasedAt.trim() || undefined,
        imageBase64,
      };

      const result = await createItem(payload);

      navigation.navigate('Success', {
        record: result,
        imageUri,
        brand: brand.trim(),
        productType,
        purchasePrice,
      });
    } catch (err) {
      console.error('[Save Error]', err.message);
      Alert.alert(
        'Save Failed',
        `Error: ${err.message || 'Could not save item to inventory. Please try again.'}`
      );
    } finally {
      setSaving(false);
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
          {/* Item Photo Preview */}
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.itemPhoto} />
          )}

          <Text style={styles.sectionTitle}>Item Details</Text>

          {/* Brand */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Brand</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Levi's, Coach, Nike..."
              placeholderTextColor="#bbb"
              value={brand}
              onChangeText={setBrand}
              autoCapitalize="words"
            />
          </View>

          {/* Product Type */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Product Type</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={productType}
                onValueChange={(value) => setProductType(value)}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {PRODUCT_TYPES.map((type) => (
                  <Picker.Item key={type} label={type} value={type} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Item Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Item Description</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Condition, color, size, any notes..."
              placeholderTextColor="#bbb"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Purchase Price */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Purchase Price ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#bbb"
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              keyboardType="decimal-pad"
            />
            {suggestedPrice > 0 && (
              <Text style={styles.hint}>
                💡 Avg sold price: ${suggestedPrice.toFixed(2)}
              </Text>
            )}
          </View>

          {/* Purchase Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Purchase Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2024-01-15"
              placeholderTextColor="#bbb"
              value={purchaseDate}
              onChangeText={setPurchaseDate}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          {/* Purchased At (Store) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Purchased At</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Goodwill, Savers, Facebook Marketplace..."
              placeholderTextColor="#bbb"
              value={purchasedAt}
              onChangeText={setPurchasedAt}
              autoCapitalize="words"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#1a1a2e" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>💾 Save to Inventory</Text>
            )}
          </TouchableOpacity>
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
    padding: 16,
    paddingBottom: 40,
  },
  itemPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    resizeMode: 'cover',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a2e',
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#1a1a2e',
  },
  pickerItem: {
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: '#27ae60',
    marginTop: 4,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#e8c547',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
});
