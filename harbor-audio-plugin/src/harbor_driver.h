#ifndef HARBOR_DRIVER_H
#define HARBOR_DRIVER_H

#include <CoreAudio/AudioServerPlugIn.h>
#include <CoreFoundation/CoreFoundation.h>
#include <mach/mach_time.h>
#include <pthread.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#ifndef kAudioObjectPropertyElementMain
#define kAudioObjectPropertyElementMain kAudioObjectPropertyElementMaster
#endif

#define kHarborPlugInObjectID ((AudioObjectID)kAudioObjectPlugInObject)
#define kHarborDeviceObjectID ((AudioObjectID)2)
#define kHarborInputStreamID ((AudioObjectID)3)
#define kHarborOutputStreamID ((AudioObjectID)4)

#define kHarborChannels ((UInt32)2)
#define kHarborBitsPerChannel ((UInt32)32)
#define kHarborBytesPerFrame ((UInt32)(kHarborChannels * sizeof(Float32)))
#define kHarborRingFrames ((UInt32)16384)
#define kHarborRingSamples ((UInt32)(kHarborRingFrames * kHarborChannels))

#define kHarborDeviceName CFSTR("Harbor Virtual Mic")
#define kHarborInputStreamName CFSTR("Harbor Virtual Mic Input")
#define kHarborOutputStreamName CFSTR("Harbor Virtual Mic Output")
#define kHarborManufacturer CFSTR("Harbor")
#define kHarborModelName CFSTR("Harbor Virtual Audio Cable")
#define kHarborDeviceUID CFSTR("HarborVirtualMic:0")
#define kHarborModelUID CFSTR("HarborVirtualMic:Model")
#define kHarborBundleID CFSTR("com.harbor.audio.virtualmic")

typedef struct {
    pthread_mutex_t lock;
    pthread_mutex_t ioLock;
    UInt32 refCount;
    AudioServerPlugInHostRef host;
    Float64 sampleRate;
    UInt32 ioRunning;
    bool inputActive;
    bool outputActive;
    Float64 hostTicksPerFrame;
    Float64 anchorSampleTime;
    UInt64 anchorHostTime;
    UInt64 timelineSeed;
    Float32 *ring;
} HarborDriverState;

extern HarborDriverState gHarbor;

const Float64 *harbor_rates(UInt32 *outCount);
bool harbor_rate_supported(Float64 rate);
void harbor_fill_format(AudioStreamBasicDescription *outFormat, Float64 rate);
Float64 harbor_host_ticks_per_frame(Float64 rate);
UInt32 harbor_streams_in_scope(AudioObjectPropertyScope scope, AudioObjectID *outStreams);
OSStatus harbor_request_rate(Float64 rate);

Boolean harbor_plugin_has(const AudioObjectPropertyAddress *address);
OSStatus harbor_plugin_settable(const AudioObjectPropertyAddress *address, Boolean *outSettable);
OSStatus harbor_plugin_size(const AudioObjectPropertyAddress *address, UInt32 *outSize);
OSStatus harbor_plugin_get(const AudioObjectPropertyAddress *address, UInt32 qualifierSize,
                           const void *qualifier, UInt32 dataSize, UInt32 *outSize, void *outData);

Boolean harbor_device_has(const AudioObjectPropertyAddress *address);
OSStatus harbor_device_settable(const AudioObjectPropertyAddress *address, Boolean *outSettable);
OSStatus harbor_device_size(const AudioObjectPropertyAddress *address, UInt32 *outSize);
OSStatus harbor_device_get(const AudioObjectPropertyAddress *address, UInt32 dataSize,
                           UInt32 *outSize, void *outData);
OSStatus harbor_device_set(const AudioObjectPropertyAddress *address, UInt32 dataSize,
                           const void *data);

Boolean harbor_stream_has(AudioObjectID stream, const AudioObjectPropertyAddress *address);
OSStatus harbor_stream_settable(AudioObjectID stream, const AudioObjectPropertyAddress *address,
                                Boolean *outSettable);
OSStatus harbor_stream_size(AudioObjectID stream, const AudioObjectPropertyAddress *address,
                            UInt32 *outSize);
OSStatus harbor_stream_get(AudioObjectID stream, const AudioObjectPropertyAddress *address,
                           UInt32 dataSize, UInt32 *outSize, void *outData);
OSStatus harbor_stream_set(AudioObjectID stream, const AudioObjectPropertyAddress *address,
                           UInt32 dataSize, const void *data);

OSStatus harbor_start_io(AudioServerPlugInDriverRef driver, AudioObjectID device, UInt32 client);
OSStatus harbor_stop_io(AudioServerPlugInDriverRef driver, AudioObjectID device, UInt32 client);
OSStatus harbor_zero_timestamp(AudioServerPlugInDriverRef driver, AudioObjectID device,
                               UInt32 client, Float64 *outSampleTime, UInt64 *outHostTime,
                               UInt64 *outSeed);
OSStatus harbor_will_do_io(AudioServerPlugInDriverRef driver, AudioObjectID device, UInt32 client,
                           UInt32 operation, Boolean *outWillDo, Boolean *outWillDoInPlace);
OSStatus harbor_begin_io(AudioServerPlugInDriverRef driver, AudioObjectID device, UInt32 client,
                         UInt32 operation, UInt32 frames, const AudioServerPlugInIOCycleInfo *cycle);
OSStatus harbor_do_io(AudioServerPlugInDriverRef driver, AudioObjectID device, AudioObjectID stream,
                      UInt32 client, UInt32 operation, UInt32 frames,
                      const AudioServerPlugInIOCycleInfo *cycle, void *mainBuffer,
                      void *secondaryBuffer);
OSStatus harbor_end_io(AudioServerPlugInDriverRef driver, AudioObjectID device, UInt32 client,
                       UInt32 operation, UInt32 frames, const AudioServerPlugInIOCycleInfo *cycle);
void harbor_silence_ring(void);

#endif
