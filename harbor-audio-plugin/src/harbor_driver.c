#include "harbor_driver.h"

static Float32 gHarborRingStorage[kHarborRingSamples];

HarborDriverState gHarbor = {
    .lock = PTHREAD_MUTEX_INITIALIZER,
    .ioLock = PTHREAD_MUTEX_INITIALIZER,
    .refCount = 1,
    .host = NULL,
    .sampleRate = 48000.0,
    .ioRunning = 0,
    .inputActive = true,
    .outputActive = true,
    .hostTicksPerFrame = 0.0,
    .anchorSampleTime = 0.0,
    .anchorHostTime = 0,
    .timelineSeed = 1,
    .ring = gHarborRingStorage,
};

static HRESULT harbor_query_interface(void *driver, REFIID uuid, LPVOID *outInterface);
static ULONG harbor_add_ref(void *driver);
static ULONG harbor_release(void *driver);
static OSStatus harbor_initialize(AudioServerPlugInDriverRef driver, AudioServerPlugInHostRef host);
static OSStatus harbor_create_device(AudioServerPlugInDriverRef driver, CFDictionaryRef description,
                                     const AudioServerPlugInClientInfo *client,
                                     AudioObjectID *outDevice);
static OSStatus harbor_destroy_device(AudioServerPlugInDriverRef driver, AudioObjectID device);
static OSStatus harbor_add_client(AudioServerPlugInDriverRef driver, AudioObjectID device,
                                  const AudioServerPlugInClientInfo *client);
static OSStatus harbor_remove_client(AudioServerPlugInDriverRef driver, AudioObjectID device,
                                     const AudioServerPlugInClientInfo *client);
static OSStatus harbor_perform_config_change(AudioServerPlugInDriverRef driver, AudioObjectID device,
                                             UInt64 action, void *info);
static OSStatus harbor_abort_config_change(AudioServerPlugInDriverRef driver, AudioObjectID device,
                                           UInt64 action, void *info);
static Boolean harbor_has_property(AudioServerPlugInDriverRef driver, AudioObjectID object,
                                   pid_t client, const AudioObjectPropertyAddress *address);
static OSStatus harbor_is_settable(AudioServerPlugInDriverRef driver, AudioObjectID object,
                                   pid_t client, const AudioObjectPropertyAddress *address,
                                   Boolean *outSettable);
static OSStatus harbor_get_size(AudioServerPlugInDriverRef driver, AudioObjectID object,
                                pid_t client, const AudioObjectPropertyAddress *address,
                                UInt32 qualifierSize, const void *qualifier, UInt32 *outSize);
static OSStatus harbor_get_data(AudioServerPlugInDriverRef driver, AudioObjectID object,
                                pid_t client, const AudioObjectPropertyAddress *address,
                                UInt32 qualifierSize, const void *qualifier, UInt32 dataSize,
                                UInt32 *outSize, void *outData);
static OSStatus harbor_set_data(AudioServerPlugInDriverRef driver, AudioObjectID object,
                                pid_t client, const AudioObjectPropertyAddress *address,
                                UInt32 qualifierSize, const void *qualifier, UInt32 dataSize,
                                const void *data);

static AudioServerPlugInDriverInterface gHarborInterface = {
    NULL,
    harbor_query_interface,
    harbor_add_ref,
    harbor_release,
    harbor_initialize,
    harbor_create_device,
    harbor_destroy_device,
    harbor_add_client,
    harbor_remove_client,
    harbor_perform_config_change,
    harbor_abort_config_change,
    harbor_has_property,
    harbor_is_settable,
    harbor_get_size,
    harbor_get_data,
    harbor_set_data,
    harbor_start_io,
    harbor_stop_io,
    harbor_zero_timestamp,
    harbor_will_do_io,
    harbor_begin_io,
    harbor_do_io,
    harbor_end_io,
};

static AudioServerPlugInDriverInterface *gHarborInterfacePtr = &gHarborInterface;
static AudioServerPlugInDriverRef gHarborDriverRef = &gHarborInterfacePtr;

void harbor_silence_ring(void)
{
    memset(gHarborRingStorage, 0, sizeof(gHarborRingStorage));
}

static HRESULT harbor_query_interface(void *driver, REFIID uuid, LPVOID *outInterface)
{
    if (driver != gHarborDriverRef || outInterface == NULL) {
        return (HRESULT)kAudioHardwareBadObjectError;
    }
    CFUUIDRef requested = CFUUIDCreateFromUUIDBytes(NULL, uuid);
    if (requested == NULL) {
        return (HRESULT)kAudioHardwareIllegalOperationError;
    }
    Boolean wanted = CFEqual(requested, IUnknownUUID) ||
                     CFEqual(requested, kAudioServerPlugInDriverInterfaceUUID);
    CFRelease(requested);
    if (!wanted) {
        return E_NOINTERFACE;
    }
    pthread_mutex_lock(&gHarbor.lock);
    gHarbor.refCount += 1;
    pthread_mutex_unlock(&gHarbor.lock);
    *outInterface = gHarborDriverRef;
    return S_OK;
}

static ULONG harbor_add_ref(void *driver)
{
    if (driver != gHarborDriverRef) {
        return 0;
    }
    pthread_mutex_lock(&gHarbor.lock);
    if (gHarbor.refCount < UINT32_MAX) {
        gHarbor.refCount += 1;
    }
    ULONG count = gHarbor.refCount;
    pthread_mutex_unlock(&gHarbor.lock);
    return count;
}

static ULONG harbor_release(void *driver)
{
    if (driver != gHarborDriverRef) {
        return 0;
    }
    pthread_mutex_lock(&gHarbor.lock);
    if (gHarbor.refCount > 0) {
        gHarbor.refCount -= 1;
    }
    ULONG count = gHarbor.refCount;
    pthread_mutex_unlock(&gHarbor.lock);
    return count;
}

static OSStatus harbor_initialize(AudioServerPlugInDriverRef driver, AudioServerPlugInHostRef host)
{
    if (driver != gHarborDriverRef) {
        return kAudioHardwareBadObjectError;
    }
    pthread_mutex_lock(&gHarbor.lock);
    gHarbor.host = host;
    Float64 rate = gHarbor.sampleRate;
    pthread_mutex_unlock(&gHarbor.lock);

    pthread_mutex_lock(&gHarbor.ioLock);
    gHarbor.hostTicksPerFrame = harbor_host_ticks_per_frame(rate);
    pthread_mutex_unlock(&gHarbor.ioLock);

    harbor_silence_ring();
    return kAudioHardwareNoError;
}

static OSStatus harbor_create_device(AudioServerPlugInDriverRef driver, CFDictionaryRef description,
                                     const AudioServerPlugInClientInfo *client,
                                     AudioObjectID *outDevice)
{
    (void)driver;
    (void)description;
    (void)client;
    (void)outDevice;
    return kAudioHardwareUnsupportedOperationError;
}

static OSStatus harbor_destroy_device(AudioServerPlugInDriverRef driver, AudioObjectID device)
{
    (void)driver;
    (void)device;
    return kAudioHardwareUnsupportedOperationError;
}

static OSStatus harbor_add_client(AudioServerPlugInDriverRef driver, AudioObjectID device,
                                  const AudioServerPlugInClientInfo *client)
{
    (void)client;
    if (driver != gHarborDriverRef) {
        return kAudioHardwareBadObjectError;
    }
    if (device != kHarborDeviceObjectID) {
        return kAudioHardwareBadObjectError;
    }
    return kAudioHardwareNoError;
}

static OSStatus harbor_remove_client(AudioServerPlugInDriverRef driver, AudioObjectID device,
                                     const AudioServerPlugInClientInfo *client)
{
    (void)client;
    if (driver != gHarborDriverRef) {
        return kAudioHardwareBadObjectError;
    }
    if (device != kHarborDeviceObjectID) {
        return kAudioHardwareBadObjectError;
    }
    return kAudioHardwareNoError;
}

static OSStatus harbor_perform_config_change(AudioServerPlugInDriverRef driver, AudioObjectID device,
                                             UInt64 action, void *info)
{
    (void)info;
    if (driver != gHarborDriverRef) {
        return kAudioHardwareBadObjectError;
    }
    if (device != kHarborDeviceObjectID) {
        return kAudioHardwareBadObjectError;
    }
    Float64 rate = (Float64)action;
    if (!harbor_rate_supported(rate)) {
        return kAudioHardwareIllegalOperationError;
    }
    pthread_mutex_lock(&gHarbor.lock);
    gHarbor.sampleRate = rate;
    pthread_mutex_unlock(&gHarbor.lock);

    pthread_mutex_lock(&gHarbor.ioLock);
    gHarbor.hostTicksPerFrame = harbor_host_ticks_per_frame(rate);
    gHarbor.anchorSampleTime = 0.0;
    gHarbor.anchorHostTime = mach_absolute_time();
    gHarbor.timelineSeed += 1;
    pthread_mutex_unlock(&gHarbor.ioLock);

    harbor_silence_ring();
    return kAudioHardwareNoError;
}

static OSStatus harbor_abort_config_change(AudioServerPlugInDriverRef driver, AudioObjectID device,
                                           UInt64 action, void *info)
{
    (void)action;
    (void)info;
    if (driver != gHarborDriverRef) {
        return kAudioHardwareBadObjectError;
    }
    if (device != kHarborDeviceObjectID) {
        return kAudioHardwareBadObjectError;
    }
    return kAudioHardwareNoError;
}

static Boolean harbor_has_property(AudioServerPlugInDriverRef driver, AudioObjectID object,
                                   pid_t client, const AudioObjectPropertyAddress *address)
{
    (void)client;
    if (driver != gHarborDriverRef || address == NULL) {
        return false;
    }
    switch (object) {
    case kHarborPlugInObjectID:
        return harbor_plugin_has(address);
    case kHarborDeviceObjectID:
        return harbor_device_has(address);
    case kHarborInputStreamID:
    case kHarborOutputStreamID:
        return harbor_stream_has(object, address);
    default:
        return false;
    }
}

static OSStatus harbor_is_settable(AudioServerPlugInDriverRef driver, AudioObjectID object,
                                   pid_t client, const AudioObjectPropertyAddress *address,
                                   Boolean *outSettable)
{
    (void)client;
    if (driver != gHarborDriverRef || address == NULL || outSettable == NULL) {
        return kAudioHardwareIllegalOperationError;
    }
    switch (object) {
    case kHarborPlugInObjectID:
        return harbor_plugin_settable(address, outSettable);
    case kHarborDeviceObjectID:
        return harbor_device_settable(address, outSettable);
    case kHarborInputStreamID:
    case kHarborOutputStreamID:
        return harbor_stream_settable(object, address, outSettable);
    default:
        return kAudioHardwareBadObjectError;
    }
}

static OSStatus harbor_get_size(AudioServerPlugInDriverRef driver, AudioObjectID object,
                                pid_t client, const AudioObjectPropertyAddress *address,
                                UInt32 qualifierSize, const void *qualifier, UInt32 *outSize)
{
    (void)client;
    (void)qualifierSize;
    (void)qualifier;
    if (driver != gHarborDriverRef || address == NULL || outSize == NULL) {
        return kAudioHardwareIllegalOperationError;
    }
    switch (object) {
    case kHarborPlugInObjectID:
        return harbor_plugin_size(address, outSize);
    case kHarborDeviceObjectID:
        return harbor_device_size(address, outSize);
    case kHarborInputStreamID:
    case kHarborOutputStreamID:
        return harbor_stream_size(object, address, outSize);
    default:
        return kAudioHardwareBadObjectError;
    }
}

static OSStatus harbor_get_data(AudioServerPlugInDriverRef driver, AudioObjectID object,
                                pid_t client, const AudioObjectPropertyAddress *address,
                                UInt32 qualifierSize, const void *qualifier, UInt32 dataSize,
                                UInt32 *outSize, void *outData)
{
    (void)client;
    if (driver != gHarborDriverRef || address == NULL || outSize == NULL || outData == NULL) {
        return kAudioHardwareIllegalOperationError;
    }
    switch (object) {
    case kHarborPlugInObjectID:
        return harbor_plugin_get(address, qualifierSize, qualifier, dataSize, outSize, outData);
    case kHarborDeviceObjectID:
        return harbor_device_get(address, dataSize, outSize, outData);
    case kHarborInputStreamID:
    case kHarborOutputStreamID:
        return harbor_stream_get(object, address, dataSize, outSize, outData);
    default:
        return kAudioHardwareBadObjectError;
    }
}

static OSStatus harbor_set_data(AudioServerPlugInDriverRef driver, AudioObjectID object,
                                pid_t client, const AudioObjectPropertyAddress *address,
                                UInt32 qualifierSize, const void *qualifier, UInt32 dataSize,
                                const void *data)
{
    (void)client;
    (void)qualifierSize;
    (void)qualifier;
    if (driver != gHarborDriverRef || address == NULL || data == NULL) {
        return kAudioHardwareIllegalOperationError;
    }
    switch (object) {
    case kHarborDeviceObjectID:
        return harbor_device_set(address, dataSize, data);
    case kHarborInputStreamID:
    case kHarborOutputStreamID:
        return harbor_stream_set(object, address, dataSize, data);
    case kHarborPlugInObjectID:
        return kAudioHardwareUnknownPropertyError;
    default:
        return kAudioHardwareBadObjectError;
    }
}

__attribute__((visibility("default"))) void *HarborVirtualMicCreate(CFAllocatorRef allocator,
                                                                   CFUUIDRef requestedTypeUUID);

void *HarborVirtualMicCreate(CFAllocatorRef allocator, CFUUIDRef requestedTypeUUID)
{
    (void)allocator;
    if (requestedTypeUUID == NULL) {
        return NULL;
    }
    if (!CFEqual(requestedTypeUUID, kAudioServerPlugInTypeUUID)) {
        return NULL;
    }
    return gHarborDriverRef;
}
