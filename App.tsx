import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer, StackActions, createNavigationContainerRef, useNavigation} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

type ParamList = {
    Home: undefined;
    B: undefined;
    C: undefined;
    D: undefined;
};

const Stack = createNativeStackNavigator<ParamList>();
const navigationRef = createNavigationContainerRef<ParamList>();

function HomeScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Home</Text>
        </View>
    );
}

function DetailScreen({name}: {name: string}) {
    const navigation = useNavigation();
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Screen {name}</Text>
            <Button
                title="Pop to top"
                onPress={() => navigation.dispatch(StackActions.popToTop())}
            />
        </View>
    );
}

const B = () => <DetailScreen name="B" />;
const C = () => <DetailScreen name="C" />;
const D = () => <DetailScreen name="D" />;

export default function App() {
    return (
        <SafeAreaProvider>
            <NavigationContainer ref={navigationRef}>
                <Stack.Navigator>
                    <Stack.Screen
                        name="Home"
                        component={HomeScreen}
                    />
                    <Stack.Screen
                        name="B"
                        component={B}
                    />
                    <Stack.Screen
                        name="C"
                        component={C}
                    />
                    <Stack.Screen
                        name="D"
                        component={D}
                    />
                </Stack.Navigator>
            </NavigationContainer>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: {padding: 16, gap: 16},
    title: {fontSize: 24},
});
