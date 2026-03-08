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
  Keyboard,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
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

/** Format a Date object to YYYY-MM-DD string */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function ConfirmPurchaseScreen({ route, navigation }) {
  const { imageUri, query, suggestedPrice } = route.params || {};

  // ── Form state ───────────────────────────────────────────────────────────────
  const [brand, setBrand] = useState(query || '');
  const [productType, setProductType] = useState('Other');
  const [description, setDescription] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date());
  const [purchasedAt, setPurchasedAt] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Date picker visibility ───────────────────────────────────────────────────
  // iOS: inline picker stays visible; Android: modal shown on tap
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');

  const handleDateChange = (event, selectedDate) => {
    // Android dismisses the modal automatically; iOS keeps it open
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type !== 'dismissed' && selectedDate) {
      setPurchaseDate(selectedDate);
    }
  };

  const handleSave = async () => {
    if (!brand.trim() && !description.trim()) {
      Alert.alert('Required Fields', 'Please enter a brand or description before saving.');
      return;
    }

    setSaving(true);
    try {
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
        purchaseDate: formatDate(purchaseDate),
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
      {/*
        KeyboardAvoidingView:
        - iOS: 'padding' shifts content up when keyboard appears
        - Android: 'height' shrinks the view so content stays visible
      */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Dismiss keyboard button ─────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.dismissKeyboardButton}
            onPress={Keyboard.dismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissKeyboardText}>⌨️ Dismiss Keyboard</Text>
          </TouchableOpacity>

          {/* ── Item Photo Preview ──────────────────────────────────────────── */}
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.itemPhoto} />
          )}

          <Text style={styles.sectionTitle}>Item Details</Text>

          {/* ── Brand ──────────────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Brand</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Levi's, Coach, Nike..."
              placeholderTextColor="#bbb"
              value={brand}
              onChangeText={setBrand}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* ── Product Type ───────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Product Type</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={productType}
                onValueChange={(value) => setProductType(value)}
                style={styles.picker}
                // itemStyle applies on iOS — must set font size here
                itemStyle={styles.pickerItem}
              >
                {PRODUCT_TYPES.map((type) => (
                  <Picker.Item
                    key={type}
                    label={type}
                    value={type}
                    // Explicit per-item style for iOS font fix
                    style={styles.pickerItemOption}
                    color="#1a1a2e"
                  />
                ))}
              </Picker>
            </View>
          </View>

          {/* ── Item Description ───────────────────────────────────────────── */}
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

          {/* ── Purchase Price ─────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Purchase Price ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#bbb"
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            {suggestedPrice > 0 && (
              <Text style={styles.hint}>
                💡 Avg sold price: ${suggestedPrice.toFixed(2)}
              </Text>
            )}
          </View>

          {/* ── Purchase Date ──────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Purchase Date</Text>

            {/* Android: show a tappable button that opens the date modal */}
            {Platform.OS === 'android' && (
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowDatePicker(true);
                }}
              >
                <Text style={styles.dateButtonText}>
                  📅 {formatDate(purchaseDate)}
                </Text>
              </TouchableOpacity>
            )}

            {/* iOS: always-visible inline spinner; Android: modal on demand */}
            {showDatePicker && (
              <DateTimePicker
                value={purchaseDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
                // iOS inline styling
                style={Platform.OS === 'ios' ? styles.iosDatePicker : undefined}
                textColor="#1a1a2e"
              />
            )}
          </View>

          {/* ── Purchased At (Store) ───────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Purchased At</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Goodwill, Savers, Facebook Marketplace..."
              placeholderTextColor="#bbb"
              value={purchasedAt}
              onChangeText={setPurchasedAt}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>

          {/* ── Save Button ────────────────────────────────────────────────── */}
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

  // ── Dismiss keyboard ─────────────────────────────────────────────────────────
  dismissKeyboardButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  dismissKeyboardText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },

  // ── Photo ────────────────────────────────────────────────────────────────────
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

  // ── Fields ───────────────────────────────────────────────────────────────────
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
  hint: {
    fontSize: 12,
    color: '#27ae60',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // ── Picker ───────────────────────────────────────────────────────────────────
  pickerWrapper: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    // Taller on iOS to accommodate the spinner-style picker
    minHeight: Platform.OS === 'ios' ? 120 : 50,
    justifyContent: 'center',
  },
  picker: {
    height: Platform.OS === 'ios' ? 120 : 50,
    color: '#1a1a2e',
  },
  pickerItem: {
    // iOS itemStyle prop — controls the spinning-wheel rows
    fontSize: 16,
    color: '#1a1a2e',
    height: 120,
  },
  pickerItemOption: {
    // Per-item style passed via <Picker.Item style={}> — iOS font fix
    fontSize: 16,
  },

  // ── Date picker ──────────────────────────────────────────────────────────────
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1a1a2e',
  },
  iosDatePicker: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginTop: 4,
  },

  // ── Save button ──────────────────────────────────────────────────────────────
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
