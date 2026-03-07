import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BUY_THRESHOLD } from '../config';

export default function ResultsScreen({ route, navigation }) {
  const { searchData, imageUri, query } = route.params || {};

  const {
    averageSoldPrice = 0,
    totalResults = 0,
    ebayResults = [],
    poshmarkResults = [],
    buyRecommendation = false,
  } = searchData || {};

  const priceColor = averageSoldPrice > BUY_THRESHOLD ? '#27ae60' : '#e74c3c';
  const formattedPrice = averageSoldPrice > 0 ? `$${averageSoldPrice.toFixed(2)}` : 'No data';

  // ── Render a single sold listing row ────────────────────────────────────────
  const renderListingItem = ({ item }) => (
    <View style={styles.listingRow}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.listingThumb} />
      ) : (
        <View style={[styles.listingThumb, styles.listingThumbPlaceholder]}>
          <Text style={{ fontSize: 20 }}>👕</Text>
        </View>
      )}
      <View style={styles.listingInfo}>
        <Text style={styles.listingTitle} numberOfLines={2}>
          {item.title || 'Untitled listing'}
        </Text>
        {item.dateSold && (
          <Text style={styles.listingDate}>
            {new Date(item.dateSold).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        )}
      </View>
      <Text style={styles.listingPrice}>
        ${typeof item.soldPrice === 'number' ? item.soldPrice.toFixed(2) : '—'}
      </Text>
    </View>
  );

  const allListings = [...ebayResults, ...poshmarkResults].slice(0, 20);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Item photo */}
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.itemPhoto} />
        )}

        {/* Search query label */}
        {query && (
          <Text style={styles.queryLabel}>Results for: "{query}"</Text>
        )}

        {/* Average price — big, prominent */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Average Sold Price</Text>
          <Text style={[styles.priceValue, { color: priceColor }]}>
            {formattedPrice}
          </Text>
          <Text style={styles.totalResults}>
            Based on {totalResults} sold listing{totalResults !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Buy / Pass recommendation banner */}
        <View
          style={[
            styles.recommendationBanner,
            buyRecommendation ? styles.bannerBuy : styles.bannerPass,
          ]}
        >
          <Text style={styles.recommendationText}>
            {averageSoldPrice === 0
              ? '🤷 Not enough data to decide'
              : buyRecommendation
              ? `✅ BUY IT — Avg sells for ${formattedPrice}`
              : `❌ PASS — Avg only ${formattedPrice}`}
          </Text>
        </View>

        {/* Sold listings list */}
        {allListings.length > 0 ? (
          <View style={styles.listingsContainer}>
            <Text style={styles.listingsHeader}>Recent Sold Listings</Text>
            {allListings.map((item, index) => (
              <View key={`listing-${index}`}>
                {renderListingItem({ item })}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyListings}>
            <Text style={styles.emptyListingsText}>
              😕 No sold listings found. Try a different search term.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.buyButton}
            onPress={() =>
              navigation.navigate('ConfirmPurchase', {
                imageUri,
                query,
                suggestedPrice: averageSoldPrice,
                searchData,
              })
            }
          >
            <Text style={styles.buyButtonText}>I BOUGHT IT 🛍️</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.passButton}
            onPress={() => navigation.navigate('Camera')}
          >
            <Text style={styles.passButtonText}>Pass</Text>
          </TouchableOpacity>
        </View>
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
    padding: 16,
    paddingBottom: 40,
  },
  itemPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    resizeMode: 'cover',
    marginBottom: 14,
  },
  queryLabel: {
    fontSize: 13,
    color: '#777',
    marginBottom: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  priceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  priceValue: {
    fontSize: 56,
    fontWeight: 'bold',
    lineHeight: 64,
  },
  totalResults: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 4,
  },
  recommendationBanner: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  bannerBuy: {
    backgroundColor: '#d4edda',
    borderWidth: 1.5,
    borderColor: '#27ae60',
  },
  bannerPass: {
    backgroundColor: '#fde8e8',
    borderWidth: 1.5,
    borderColor: '#e74c3c',
  },
  recommendationText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1a1a2e',
    textAlign: 'center',
  },
  listingsContainer: {
    marginBottom: 24,
  },
  listingsHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 10,
  },
  listingRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 2,
  },
  listingThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    resizeMode: 'cover',
    backgroundColor: '#e0e0e0',
    marginRight: 10,
  },
  listingThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingInfo: {
    flex: 1,
    marginRight: 8,
  },
  listingTitle: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    lineHeight: 18,
  },
  listingDate: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 3,
  },
  listingPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#27ae60',
    minWidth: 52,
    textAlign: 'right',
  },
  emptyListings: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyListingsText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButtons: {
    gap: 12,
  },
  buyButton: {
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
  buyButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  passButton: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ccc',
  },
  passButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#666',
  },
});
