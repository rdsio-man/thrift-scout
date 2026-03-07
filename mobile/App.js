import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import CameraScreen from './src/screens/CameraScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import ConfirmPurchaseScreen from './src/screens/ConfirmPurchaseScreen';
import SuccessScreen from './src/screens/SuccessScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Camera"
            screenOptions={{
              headerStyle: { backgroundColor: '#1a1a2e' },
              headerTintColor: '#e8c547',
              headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
              cardStyle: { backgroundColor: '#f5f5f5' },
            }}
          >
            <Stack.Screen
              name="Camera"
              component={CameraScreen}
              options={{ title: 'Thrift Scout 🔍', headerLeft: () => null }}
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
              options={{ title: 'Saved! 🎉', headerLeft: () => null }}
            />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
