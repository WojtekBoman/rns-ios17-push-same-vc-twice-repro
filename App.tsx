/**
 * Repro: react-native-screens iOS crash on iOS 17 (and 16)
 * "<RNSNavigationController> is pushing the same view controller instance (<RNSScreen>) more than once"
 *
 * Tap "Crash" on an iOS 17 simulator. iOS 18+ does not crash.
 */

import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {CommonActions, NavigationContainer, StackActions, createNavigationContainerRef, useNavigation} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

type ParamList = {
    Home: undefined;
    B: undefined;
    C: undefined;
    D: undefined;
};

const Stack = createNativeStackNavigator<ParamList>();
const navigationRef = createNavigationContainerRef<ParamList>();

function run(preload: boolean) {
    if (preload) {
        navigationRef.dispatch(CommonActions.preload('D'));
    }
    // Wait so the preload is mounted on its own.
    setTimeout(() => {
        const root = navigationRef.getRootState();

        // 1. Show two new screens at once. Native side: setViewControllers:[Home, B] animated:NO,
        //    then pushViewController:C animated:YES. On iOS 17 UIKit holds this push until the
        //    current CA transaction commits, so C is not in viewControllers yet and
        //    transitionCoordinator is nil.
        navigationRef.dispatch(
            CommonActions.reset({
                index: 2,
                routes: [root.routes[0], {name: 'B'}, {name: 'C'}],
                preloadedRoutes: root.preloadedRoutes,
            } as never),
        );

        // 2. Right after, show the preloaded screen D. Its activityState changes 0 -> 2, which calls
        //    RNSScreenStackView updateContainer synchronously during the mount, in the same main
        //    thread turn as step 1. RNS does not see the held push and pushes again.
        setTimeout(() => navigationRef.navigate('D'), 0);
    }, 500);
}

function HomeScreen() {
    return (
        <View style={styles.container}>
            <Button
                title="Crash: reset to Home > B > C, then navigate to preloaded D"
                onPress={() => run(true)}
            />
            <Button
                title="Control: same without preload (no crash)"
                onPress={() => run(false)}
            />
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
