#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DeviceIntegrity, NSObject)

RCT_EXTERN_METHOD(checkJailbreak:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getFullReport:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
