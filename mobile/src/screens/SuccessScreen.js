import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SuccessScreen({ route, navigation }) {
  const {
    record,
    imageUri,
    brand,
    productType,
    purchasePrice,
  } = route.params || {};

  const airtableRecordId = record?.id || '';

  // Deep link into the Airtable app (mobile) or web (fallback)
  const handleViewInAirtable = async () => {
    const baseId = 'app6m3AeF51whZ1Ah';
    const tableId = 'tbl5Z8YEYzZoj9p5p';

    // Try the Airtable mobile app deep link first
    const appUrl = `airtable://app.airtable.com/${baseId}/${tableId}/${airtableRecordId}`;
    const webUrl = `https://airtable.com/${baseId}/${tableId}/${airtableRecordId}`;

    try {
      const canOpenApp = await Linking.canOpenURL(appUrl);
      if (canOpenApp) {
        await Linking.openURL(appUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch (err) {
      Alert.alert('Could not open Airtable', err.message);
    }
  };

  const handleScanAnother = () => {
    navigation.navigate('Camera');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Success Icon */}
        <View style={styles.iconWrapper}>
          <Text style={styles.successIcon}>🎉</Text>
        </View>

        <Text style={styles.title}>Item Saved!</Text>
        <Text style={styles.subtitle}>
          Your item has been added to your Thrift Scout inventory.
        </Text>

        {/* Item Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Item Summary</Text>

          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.summaryImage} />
          )}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Brand</Text>
            <Text style={styles.summaryValue}>{brand || '—'}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Type</Text>
            <Text style={styles.summaryValue}>{record?.fields?.fldgu14FP3WnZCtlB || '—'}</Text>
          </View>

          {purchasePrice ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Purchase Price</Text>
              <Text style={[styles.summaryValue, styles.priceValue]}>
                ${parseFloat(purchasePrice).toFixed(2)}
              </Text>
            </View>
          ) : null}

          {airtableRecordId ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Record ID</Text>
              <Text style={[styles.summaryValue, styles.recordId]} numberOfLines={1}>
                {airtableRecordId}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.primaryButton} onPress={handleScanAnother}>
          <Text style={styles.primaryButtonText}>🔍 Scan Another Item</Text>
        </TouchableOpacity>

        {airtableRecordId ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={handleViewInAirtable}>
            <Text style={styles.secondaryButtonText}>📊 View in Airtable</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    padding: 24,
    alignItems: 'center',
    paddingBottom: 40,
  },
  iconWrapper: {
    marginTop: 16,
    marginBottom: 8,
  },
  successIcon: {
    fontSize: 72,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 28,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 14,
  },
  summaryImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    resizeMode: 'cover',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 15,
    color: '#1a1a2e',
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  priceValue: {
    color: '#27ae60',
    fontWeight: 'bold',
  },
  recordId: {
    fontSize: 12,
    color: '#aaa',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#e8c547',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1a1a2e',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a2e',
  },
});
