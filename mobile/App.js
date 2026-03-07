import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CameraScreen from './src/screens/CameraScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import ConfirmPurchaseScreen from './src/screens/ConfirmPurchaseScreen';
import SuccessScreen from './src/screens/SuccessScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Camera"
          screenOptions={{
            headerStyle: { backgroundColor: '#1a1a2e' },
            headerTintColor: '#e8c547',
            headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
            contentStyle: { backgroundColor: '#f5f5f5' },
          }}
        >
          <Stack.Screen
            name="Camera"
            component={CameraScreen}
            options={{ title: 'Thrift Scout 🔍', headerBackVisible: false }}
          />
          <Stack.Screen
            name="Results"
            component={ResultsScreen}
            options={{ title: 'Price Check 💰' }}
          />
          <Stack.Screen
            name="ConfirmPurchase"
            component={ConfirmPurchaseScreen}
            options={{ title: 'Save to Inventory 🛍️' }}
          />
          <Stack.Screen
            name="Success"
            component={SuccessScreen}
            options={{ title: 'Saved! 🎉', headerBackVisible: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
