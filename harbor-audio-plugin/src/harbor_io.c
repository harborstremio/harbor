#include "harbor_driver.h"

static UInt32 harbor_ring_offset(Float64 sampleTime)
{
    SInt64 frame = (SInt64)sampleTime;
    SInt64 wrapped = frame % (SInt64)kHarborRingFrames;
    if (wrapped < 0) {
        wrapped += (SInt64)kHarborRingFrames;
    }
    return (UInt32)wrapped;
}

static void harbor_ring_write(const Float32 *source, UInt32 offset, UInt32 frames)
{
    UInt32 head = kHarborRingFrames - offset;
    if (head > frames) {
        head = frames;
    }
    memcpy(gHarbor.ring + (size_t)offset * kHarborChannels, source,
           (size_t)head * kHarborBytesPerFrame);
    UInt32 tail = frames - head;
    if (tail > 0) {
        memcpy(gHarbor.ring, source + (size_t)head * kHarborChannels,
               (size_t)tail * kHarborBytesPerFrame);
    }
}

static void harbor_ring_read(Float32 *destination, UInt32 offset, UInt32 frames)
{
    UInt32 head = kHarborRingFrames - offset;
    if (head > frames) {
        head = frames;
    }
    memcpy(destination, gHarbor.ring + (size_t)offset * kHarborChannels,
           (size_t)head * kHarborBytesPerFrame);
    UInt32 tail = frames - head;
    if (tail > 0) {
        memcpy(destination + (size_t)head * kHarborChannels, gHarbor.ring,
               (size_t)tail * kHarborBytesPerFrame);
    }
}

OSStatus harbor_start_io(AudioServerPlugInDriverRef driver, AudioObjectID device, UInt32 client)
{
    (void)driver;
    (void)client;
    if (device != kHarborDeviceObjectID) {
        return kAudioHardwareBadObjectError;
    }
    pthread_mutex_lock(&gHarbor.lock);
    Float64 rate = gHarbor.sampleRate;
    pthread_mutex_unlock(&gHarbor.lock);

    pthread_mutex_lock(&gHarbor.ioLock);
    bool first = gHarbor.ioRunning == 0;
    if (first) {
        gHarbor.hostTicksPerFrame = harbor_host_ticks_per_frame(rate);
        gHarbor.anchorSampleTime = 0.0;
        gHarbor.anchorHostTime = mach_absolute_time();
        gHarbor.timelineSeed += 1;
    }
    gHarbor.ioRunning += 1;
    pthread_mutex_unlock(&gHarbor.ioLock);

    if (first) {
        harbor_silence_ring();
    }
    return kAudioHardwareNoError;
}

OSStatus harbor_stop_io(AudioServerPlugInDriverRef driver, AudioObjectID device, UInt32 client)
{
    (void)driver;
    (void)client;
    if (device != kHarborDeviceObjectID) {
        return kAudioHardwareBadObjectError;
    }
    pthread_mutex_lock(&gHarbor.ioLock);
    if (gHarbor.ioRunning > 0) {
        gHarbor.ioRunning -= 1;
    }
    bool last = gHarbor.ioRunning == 0;
    pthread_mutex_unlock(&gHarbor.ioLock);
    if (last) {
        harbor_silence_ring();
    }
    return kAudioHardwareNoError;
}

OSStatus harbor_zero_timestamp(AudioServerPlugInDriverRef driver, AudioObjectID device,
                               UInt32 client, Float64 *outSampleTime, UInt64 *outHostTime,
                               UInt64 *outSeed)
{
    (void)driver;
    (void)client;
    if (device != kHarborDeviceObjectID) {
        return kAudioHardwareBadObjectError;
    }
    if (outSampleTime == NULL || outHostTime == NULL || outSeed == NULL) {
        return kAudioHardwareIllegalOperationError;
    }

    pthread_mutex_lock(&gHarbor.ioLock);
    Float64 ticksPerRing = gHarbor.hostTicksPerFrame * (Float64)kHarborRingFrames;
    UInt64 now = mach_absolute_time();
    if (ticksPerRing > 0.0 && now > gHarbor.anchorHostTime) {
        Float64 elapsed = (Float64)(now - gHarbor.anchorHostTime);
        if (elapsed >= ticksPerRing) {
            Float64 periods = (Float64)(UInt64)(elapsed / ticksPerRing);
            gHarbor.anchorSampleTime += periods * (Float64)kHarborRingFrames;
            gHarbor.anchorHostTime += (UInt64)(periods * ticksPerRing);
        }
    }
    *outSampleTime = gHarbor.anchorSampleTime;
    *outHostTime = gHarbor.anchorHostTime;
    *outSeed = gHarbor.timelineSeed;
    pthread_mutex_unlock(&gHarbor.ioLock);
    return kAudioHardwareNoError;
}

OSStatus harbor_will_do_io(AudioServerPlugInDriverRef driver, AudioObjectID device, UInt32 client,
                           UInt32 operation, Boolean *outWillDo, Boolean *outWillDoInPlace)
{
    (void)driver;
    (void)client;
    if (device != kHarborDeviceObjectID) {
        return kAudioHardwareBadObjectError;
    }
    if (outWillDo == NULL || outWillDoInPlace == NULL) {
        return kAudioHardwareIllegalOperationError;
    }
    Boolean handled = operation == kAudioServerPlugInIOOperationReadInput ||
                      operation == kAudioServerPlugInIOOperationWriteMix;
    *outWillDo = handled;
    *outWillDoInPlace = true;
    return kAudioHardwareNoError;
}

OSStatus harbor_begin_io(AudioServerPlugInDriverRef driver, AudioObjectID device, UInt32 client,
                         UInt32 operation, UInt32 frames, const AudioServerPlugInIOCycleInfo *cycle)
{
    (void)driver;
    (void)client;
    (void)operation;
    (void)frames;
    (void)cycle;
    if (device != kHarborDeviceObjectID) {
        return kAudioHardwareBadObjectError;
    }
    return kAudioHardwareNoError;
}

OSStatus harbor_do_io(AudioServerPlugInDriverRef driver, AudioObjectID device, AudioObjectID stream,
                      UInt32 client, UInt32 operation, UInt32 frames,
                      const AudioServerPlugInIOCycleInfo *cycle, void *mainBuffer,
                      void *secondaryBuffer)
{
    (void)driver;
    (void)stream;
    (void)client;
    (void)secondaryBuffer;
    if (device != kHarborDeviceObjectID) {
        return kAudioHardwareBadObjectError;
    }
    if (mainBuffer == NULL || cycle == NULL || frames == 0) {
        return kAudioHardwareNoError;
    }
    if (frames > kHarborRingFrames) {
        frames = kHarborRingFrames;
    }

    if (operation == kAudioServerPlugInIOOperationWriteMix) {
        harbor_ring_write((const Float32 *)mainBuffer,
                          harbor_ring_offset(cycle->mOutputTime.mSampleTime), frames);
        return kAudioHardwareNoError;
    }

    if (operation == kAudioServerPlugInIOOperationReadInput) {
        harbor_ring_read((Float32 *)mainBuffer,
                         harbor_ring_offset(cycle->mInputTime.mSampleTime), frames);
        return kAudioHardwareNoError;
    }

    return kAudioHardwareNoError;
}

OSStatus harbor_end_io(AudioServerPlugInDriverRef driver, AudioObjectID device, UInt32 client,
                       UInt32 operation, UInt32 frames, const AudioServerPlugInIOCycleInfo *cycle)
{
    (void)driver;
    (void)client;
    (void)operation;
    (void)frames;
    (void)cycle;
    if (device != kHarborDeviceObjectID) {
        return kAudioHardwareBadObjectError;
    }
    return kAudioHardwareNoError;
}
