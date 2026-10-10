#include "harbor_driver.h"

Boolean harbor_device_has(const AudioObjectPropertyAddress *address)
{
    switch (address->mSelector) {
    case kAudioObjectPropertyBaseClass:
    case kAudioObjectPropertyClass:
    case kAudioObjectPropertyOwner:
    case kAudioObjectPropertyName:
    case kAudioObjectPropertyManufacturer:
    case kAudioObjectPropertyModelName:
    case kAudioObjectPropertyOwnedObjects:
    case kAudioObjectPropertyControlList:
    case kAudioObjectPropertyCustomPropertyInfoList:
    case kAudioDevicePropertyDeviceUID:
    case kAudioDevicePropertyModelUID:
    case kAudioDevicePropertyTransportType:
    case kAudioDevicePropertyRelatedDevices:
    case kAudioDevicePropertyClockDomain:
    case kAudioDevicePropertyDeviceIsAlive:
    case kAudioDevicePropertyDeviceIsRunning:
    case kAudioDevicePropertyDeviceCanBeDefaultDevice:
    case kAudioDevicePropertyDeviceCanBeDefaultSystemDevice:
    case kAudioDevicePropertyLatency:
    case kAudioDevicePropertyStreams:
    case kAudioDevicePropertySafetyOffset:
    case kAudioDevicePropertyNominalSampleRate:
    case kAudioDevicePropertyAvailableNominalSampleRates:
    case kAudioDevicePropertyIsHidden:
    case kAudioDevicePropertyPreferredChannelsForStereo:
    case kAudioDevicePropertyPreferredChannelLayout:
    case kAudioDevicePropertyZeroTimeStampPeriod:
        return true;
    default:
        return false;
    }
}

OSStatus harbor_device_settable(const AudioObjectPropertyAddress *address, Boolean *outSettable)
{
    if (!harbor_device_has(address)) {
        return kAudioHardwareUnknownPropertyError;
    }
    *outSettable = address->mSelector == kAudioDevicePropertyNominalSampleRate;
    return kAudioHardwareNoError;
}

OSStatus harbor_device_size(const AudioObjectPropertyAddress *address, UInt32 *outSize)
{
    UInt32 rateCount = 0;
    harbor_rates(&rateCount);

    switch (address->mSelector) {
    case kAudioObjectPropertyBaseClass:
    case kAudioObjectPropertyClass:
        *outSize = sizeof(AudioClassID);
        return kAudioHardwareNoError;
    case kAudioObjectPropertyOwner:
        *outSize = sizeof(AudioObjectID);
        return kAudioHardwareNoError;
    case kAudioObjectPropertyName:
    case kAudioObjectPropertyManufacturer:
    case kAudioObjectPropertyModelName:
    case kAudioDevicePropertyDeviceUID:
    case kAudioDevicePropertyModelUID:
        *outSize = sizeof(CFStringRef);
        return kAudioHardwareNoError;
    case kAudioObjectPropertyOwnedObjects:
    case kAudioDevicePropertyStreams:
        *outSize = harbor_streams_in_scope(address->mScope, NULL) * sizeof(AudioObjectID);
        return kAudioHardwareNoError;
    case kAudioObjectPropertyControlList:
    case kAudioObjectPropertyCustomPropertyInfoList:
        *outSize = 0;
        return kAudioHardwareNoError;
    case kAudioDevicePropertyRelatedDevices:
        *outSize = sizeof(AudioObjectID);
        return kAudioHardwareNoError;
    case kAudioDevicePropertyTransportType:
    case kAudioDevicePropertyClockDomain:
    case kAudioDevicePropertyDeviceIsAlive:
    case kAudioDevicePropertyDeviceIsRunning:
    case kAudioDevicePropertyDeviceCanBeDefaultDevice:
    case kAudioDevicePropertyDeviceCanBeDefaultSystemDevice:
    case kAudioDevicePropertyLatency:
    case kAudioDevicePropertySafetyOffset:
    case kAudioDevicePropertyIsHidden:
    case kAudioDevicePropertyZeroTimeStampPeriod:
        *outSize = sizeof(UInt32);
        return kAudioHardwareNoError;
    case kAudioDevicePropertyNominalSampleRate:
        *outSize = sizeof(Float64);
        return kAudioHardwareNoError;
    case kAudioDevicePropertyAvailableNominalSampleRates:
        *outSize = rateCount * (UInt32)sizeof(AudioValueRange);
        return kAudioHardwareNoError;
    case kAudioDevicePropertyPreferredChannelsForStereo:
        *outSize = 2 * sizeof(UInt32);
        return kAudioHardwareNoError;
    case kAudioDevicePropertyPreferredChannelLayout:
        *outSize = sizeof(AudioChannelLayout);
        return kAudioHardwareNoError;
    default:
        return kAudioHardwareUnknownPropertyError;
    }
}

static OSStatus harbor_device_string(CFStringRef value, UInt32 dataSize, UInt32 *outSize,
                                     void *outData)
{
    if (dataSize < sizeof(CFStringRef)) {
        return kAudioHardwareBadPropertySizeError;
    }
    *((CFStringRef *)outData) = CFStringCreateCopy(NULL, value);
    *outSize = sizeof(CFStringRef);
    return kAudioHardwareNoError;
}

static OSStatus harbor_device_u32(UInt32 value, UInt32 dataSize, UInt32 *outSize, void *outData)
{
    if (dataSize < sizeof(UInt32)) {
        return kAudioHardwareBadPropertySizeError;
    }
    *((UInt32 *)outData) = value;
    *outSize = sizeof(UInt32);
    return kAudioHardwareNoError;
}

static OSStatus harbor_device_objects(AudioObjectPropertyScope scope, UInt32 dataSize,
                                      UInt32 *outSize, void *outData)
{
    AudioObjectID streams[2] = {0, 0};
    UInt32 available = harbor_streams_in_scope(scope, streams);
    UInt32 room = dataSize / (UInt32)sizeof(AudioObjectID);
    UInt32 written = room < available ? room : available;
    for (UInt32 index = 0; index < written; index += 1) {
        ((AudioObjectID *)outData)[index] = streams[index];
    }
    *outSize = written * (UInt32)sizeof(AudioObjectID);
    return kAudioHardwareNoError;
}

static OSStatus harbor_device_rates(UInt32 dataSize, UInt32 *outSize, void *outData)
{
    UInt32 count = 0;
    const Float64 *rates = harbor_rates(&count);
    UInt32 room = dataSize / (UInt32)sizeof(AudioValueRange);
    UInt32 written = room < count ? room : count;
    AudioValueRange *ranges = (AudioValueRange *)outData;
    for (UInt32 index = 0; index < written; index += 1) {
        ranges[index].mMinimum = rates[index];
        ranges[index].mMaximum = rates[index];
    }
    *outSize = written * (UInt32)sizeof(AudioValueRange);
    return kAudioHardwareNoError;
}

OSStatus harbor_device_get(const AudioObjectPropertyAddress *address, UInt32 dataSize,
                           UInt32 *outSize, void *outData)
{
    switch (address->mSelector) {
    case kAudioObjectPropertyBaseClass:
        if (dataSize < sizeof(AudioClassID)) {
            return kAudioHardwareBadPropertySizeError;
        }
        *((AudioClassID *)outData) = kAudioObjectClassID;
        *outSize = sizeof(AudioClassID);
        return kAudioHardwareNoError;

    case kAudioObjectPropertyClass:
        if (dataSize < sizeof(AudioClassID)) {
            return kAudioHardwareBadPropertySizeError;
        }
        *((AudioClassID *)outData) = kAudioDeviceClassID;
        *outSize = sizeof(AudioClassID);
        return kAudioHardwareNoError;

    case kAudioObjectPropertyOwner:
        if (dataSize < sizeof(AudioObjectID)) {
            return kAudioHardwareBadPropertySizeError;
        }
        *((AudioObjectID *)outData) = kHarborPlugInObjectID;
        *outSize = sizeof(AudioObjectID);
        return kAudioHardwareNoError;

    case kAudioObjectPropertyName:
        return harbor_device_string(kHarborDeviceName, dataSize, outSize, outData);
    case kAudioObjectPropertyManufacturer:
        return harbor_device_string(kHarborManufacturer, dataSize, outSize, outData);
    case kAudioObjectPropertyModelName:
        return harbor_device_string(kHarborModelName, dataSize, outSize, outData);
    case kAudioDevicePropertyDeviceUID:
        return harbor_device_string(kHarborDeviceUID, dataSize, outSize, outData);
    case kAudioDevicePropertyModelUID:
        return harbor_device_string(kHarborModelUID, dataSize, outSize, outData);

    case kAudioObjectPropertyOwnedObjects:
    case kAudioDevicePropertyStreams:
        return harbor_device_objects(address->mScope, dataSize, outSize, outData);

    case kAudioObjectPropertyControlList:
    case kAudioObjectPropertyCustomPropertyInfoList:
        *outSize = 0;
        return kAudioHardwareNoError;

    case kAudioDevicePropertyRelatedDevices:
        if (dataSize < sizeof(AudioObjectID)) {
            *outSize = 0;
            return kAudioHardwareNoError;
        }
        *((AudioObjectID *)outData) = kHarborDeviceObjectID;
        *outSize = sizeof(AudioObjectID);
        return kAudioHardwareNoError;

    case kAudioDevicePropertyTransportType:
        return harbor_device_u32(kAudioDeviceTransportTypeVirtual, dataSize, outSize, outData);
    case kAudioDevicePropertyClockDomain:
        return harbor_device_u32(0, dataSize, outSize, outData);
    case kAudioDevicePropertyDeviceIsAlive:
        return harbor_device_u32(1, dataSize, outSize, outData);
    case kAudioDevicePropertyDeviceCanBeDefaultDevice:
    case kAudioDevicePropertyDeviceCanBeDefaultSystemDevice:
        return harbor_device_u32(1, dataSize, outSize, outData);
    case kAudioDevicePropertyLatency:
    case kAudioDevicePropertySafetyOffset:
    case kAudioDevicePropertyIsHidden:
        return harbor_device_u32(0, dataSize, outSize, outData);
    case kAudioDevicePropertyZeroTimeStampPeriod:
        return harbor_device_u32(kHarborRingFrames, dataSize, outSize, outData);

    case kAudioDevicePropertyDeviceIsRunning: {
        pthread_mutex_lock(&gHarbor.ioLock);
        UInt32 running = gHarbor.ioRunning > 0 ? 1 : 0;
        pthread_mutex_unlock(&gHarbor.ioLock);
        return harbor_device_u32(running, dataSize, outSize, outData);
    }

    case kAudioDevicePropertyNominalSampleRate: {
        if (dataSize < sizeof(Float64)) {
            return kAudioHardwareBadPropertySizeError;
        }
        pthread_mutex_lock(&gHarbor.lock);
        Float64 rate = gHarbor.sampleRate;
        pthread_mutex_unlock(&gHarbor.lock);
        *((Float64 *)outData) = rate;
        *outSize = sizeof(Float64);
        return kAudioHardwareNoError;
    }

    case kAudioDevicePropertyAvailableNominalSampleRates:
        return harbor_device_rates(dataSize, outSize, outData);

    case kAudioDevicePropertyPreferredChannelsForStereo:
        if (dataSize < 2 * sizeof(UInt32)) {
            return kAudioHardwareBadPropertySizeError;
        }
        ((UInt32 *)outData)[0] = 1;
        ((UInt32 *)outData)[1] = 2;
        *outSize = 2 * sizeof(UInt32);
        return kAudioHardwareNoError;

    case kAudioDevicePropertyPreferredChannelLayout: {
        if (dataSize < sizeof(AudioChannelLayout)) {
            return kAudioHardwareBadPropertySizeError;
        }
        AudioChannelLayout *layout = (AudioChannelLayout *)outData;
        memset(layout, 0, sizeof(AudioChannelLayout));
        layout->mChannelLayoutTag = kAudioChannelLayoutTag_Stereo;
        *outSize = sizeof(AudioChannelLayout);
        return kAudioHardwareNoError;
    }

    default:
        return kAudioHardwareUnknownPropertyError;
    }
}

OSStatus harbor_device_set(const AudioObjectPropertyAddress *address, UInt32 dataSize,
                           const void *data)
{
    if (address->mSelector != kAudioDevicePropertyNominalSampleRate) {
        if (harbor_device_has(address)) {
            return kAudioHardwareUnsupportedOperationError;
        }
        return kAudioHardwareUnknownPropertyError;
    }
    if (dataSize != sizeof(Float64)) {
        return kAudioHardwareBadPropertySizeError;
    }
    return harbor_request_rate(*((const Float64 *)data));
}
