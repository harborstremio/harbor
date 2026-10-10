/*
 * This file is part of libudfread
 * Copyright (C) 2014-2026 VLC authors and VideoLAN
 *
 * Authors: Petri Hintukainen <phintuka@users.sourceforge.net>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library. If not, see
 * <http://www.gnu.org/licenses/>.
 */

#if defined (__GCC_HAVE_SYNC_COMPARE_AND_SWAP_4) || (defined (__clang__) && (defined (__x86_64__) || defined (__i386__)))

#  define atomic_pointer_compare_and_exchange(atomic, oldval, newval) \
    __sync_bool_compare_and_swap((atomic), (oldval), (newval))
#  define atomic_load_acquire(atomic) \
    __sync_fetch_and_add((atomic), 0)

#elif defined(_WIN32)

#  include <windows.h>
#  define atomic_pointer_compare_and_exchange(atomic, oldval, newval) \
    (InterlockedCompareExchangePointer((PVOID volatile *)(atomic), (newval), (oldval)) == (oldval))
#  define atomic_load_acquire(atomic) \
    InterlockedCompareExchangePointer((PVOID volatile *)(atomic), NULL, NULL)

#elif defined(HAVE_PTHREAD_H)

#include <pthread.h>

static void _udf_atomic_guard(int lock)
{
    static pthread_mutex_t atomic_lock = PTHREAD_MUTEX_INITIALIZER;
    if (lock) {
        pthread_mutex_lock(&atomic_lock);
    } else {
        pthread_mutex_unlock(&atomic_lock);
    }
}

static int atomic_pointer_compare_and_exchange(void *atomic, void *oldval, void *newval)
{
    int result;
    _udf_atomic_guard(1);
    result = *(void**)atomic == oldval;
    if (result) {
        *(void**)atomic = newval;
    }
    _udf_atomic_guard(0);
    return result;
}

static inline void *atomic_load_acquire(void *atomic)
{
    void *result;
    _udf_atomic_guard(1);
    result = *(void**)atomic;
    _udf_atomic_guard(0);
    return result;
}

#else
# error no atomic operation support
#endif
