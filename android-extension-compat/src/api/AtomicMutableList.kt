package com.lagradost.cloudstream3.utils

import java.util.concurrent.CopyOnWriteArrayList

class AtomicMutableList<T>(elements: Collection<T> = emptyList()) :
    MutableList<T> by CopyOnWriteArrayList(elements)
