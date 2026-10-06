# react-native-screens: "pushing the same view controller instance more than once" on iOS 17

Minimal repro for an iOS crash in `react-native-screens` native stack:

```
*** Terminating app due to uncaught exception 'NSInvalidArgumentException', reason:
'<RNSNavigationController: 0x...> is pushing the same view controller instance (<RNSScreen: 0x...>)
more than once which is not supported and is most likely an error in the application'
```

Crash stack (main thread):

```
objc_exception_throw
-[UINavigationController pushViewController:transition:forceImmediate:]
-[_UIAfterCACommitBlock run]
-[_UIAfterCACommitQueue flush]
_runAfterCACommitDeferredBlocks
_cleanUpAfterCAFlushAndRunDeferredBlocks
_afterCACommitHandler
```

## Versions

- react-native 0.86.0 (New Architecture / Fabric)
- react-native-screens 4.28.0
- @react-navigation/native 7.1.33, @react-navigation/native-stack 7.14.5
- Xcode 26.6, simulators: iOS 17.2 (crashes), iOS 26.5 (does not crash)

## Steps

```sh
npm install
cd ios && bundle install && bundle exec pod install && cd ..
npm start
npm run ios -- --simulator "<an iOS 17 simulator>"
```

1. Tap **Crash: reset to Home > B > C, then navigate to preloaded D**.
2. The app crashes with the exception above.

**Control: same without preload** runs the same navigation without preloading D. It does not crash.

Results on our machine:

| Simulator            | Crash button                                                     | Control button |
| -------------------- | ---------------------------------------------------------------- | -------------- |
| iOS 17.2             | crash 8/8                                                        | no crash 3/3   |
| iOS 26.5             | no crash 3/3                                                     | -              |
| iOS 17.2 + fix patch | no crash 5/5 idle, 8/8 under CPU load, stack is Home > B > C > D | -              |

## Code that triggers the crash

[`run()` in `App.tsx`](App.tsx#L24-L49). Two navigation state changes on the same native stack, right after each other:

```tsx
navigationRef.dispatch(CommonActions.preload('D')); // D is mounted, but not shown (activityState 0)

setTimeout(() => {
    // 1. Multi-screen change: Home -> Home > B > C
    navigationRef.dispatch(
        CommonActions.reset({
            index: 2,
            routes: [root.routes[0], {name: 'B'}, {name: 'C'}],
            preloadedRoutes: root.preloadedRoutes,
        }),
    );

    // 2. Second change before UIKit applies the push of C from step 1
    setTimeout(() => navigationRef.navigate('D'), 0);
}, 500);
```

Native code in react-native-screens 4.28.0 that does the double push:

- Step 1 goes through the non-animated set + animated push branch of `setPushViewControllers:`
  ([RNSScreenStack.mm#L657-L665](https://github.com/software-mansion/react-native-screens/blob/4.28.0/ios/RNSScreenStack.mm#L657-L665)):

    ```objc
    [_controller setViewControllers:newControllers animated:NO];
    [_controller pushViewController:top animated:YES]; // held by UIKit on iOS 17
    ```

- Step 2 changes D's `activityState`, which calls `updateContainer` synchronously
  ([RNSScreen.mm#L331-L339](https://github.com/software-mansion/react-native-screens/blob/4.28.0/ios/RNSScreen.mm#L331-L339)).
- `setPushViewControllers:` has two guards against changing the stack while a push is in progress:
  `isEqualToArray:` and `transitionCoordinator != nil`
  ([RNSScreenStack.mm#L579-L610](https://github.com/software-mansion/react-native-screens/blob/4.28.0/ios/RNSScreenStack.mm#L579-L610)).
  Neither sees the held push of C, so C is pushed a second time.

## What happens

See `run()` in `App.tsx`.

1. `reset` to `Home > B > C` makes `RNSScreenStackView setPushViewControllers:` call
   `setViewControllers:[Home, B] animated:NO` and then `pushViewController:C animated:YES` in the same turn.
   On iOS 17, UIKit does not apply this push immediately. It holds it until the current Core Animation
   transaction commits (the push later runs from `_UIAfterCACommitBlock`). Until then, C is not in
   `viewControllers` and `transitionCoordinator` is `nil`.
2. Right after, `navigate('D')` activates the preloaded screen D. Its `activityState` changes from 0 to 2.
   `RNSScreenView setActivityStateOrNil:` calls `markChildUpdated`, which calls `updateContainer`
   synchronously during the mount, before the CA commit.
3. `setPushViewControllers:` passes both of its guards (`isEqualToArray:` and `transitionCoordinator != nil`),
   because C is not in `viewControllers` yet. It calls `setViewControllers:[Home, B, C]` and pushes D (or, with
   other timings, pushes C again).
4. When the CA transaction commits, UIKit runs the held push of C. C is already a child, so
   `_sanityCheckPushViewController:` throws.

On iOS 18+ the push from step 1 is applied immediately (`transitionCoordinator` is non-nil right after it),
so the existing `transitionCoordinator` guard defers step 3 and nothing crashes.

Any second synchronous `updateContainer` in that window has the same effect. Preload activation is a simple
way to get one from JS.

## Fix

`fix/react-native-screens+4.28.0.patch` makes `RNSScreenStackView` remember a pushed controller that UIKit did
not add to `viewControllers` immediately. While that push is pending, `setPushViewControllers:` skips the update
and retries on the next main queue turn. The pending controller is cleared when it shows up in
`viewControllers` or when `navigationController:didShowViewController:animated:` reports that same controller.
`didShow` for any other controller does not clear it: the non-animated `setViewControllers:` right before the
push reports `didShow` for its own top controller, and when the main thread is busy that can arrive before
UIKit runs the held push.

```sh
npm run fix:apply    # then rebuild the iOS app
npm run fix:revert
```

`run_scenario.sh` is a helper we used to run the buttons with [agent-device](https://www.npmjs.com/package/agent-device).
