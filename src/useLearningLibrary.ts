import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export interface LearningLibrary {
  saved: string[];
  recent: string[];
  lastOpened: Record<string, string>;
}

const emptyLibrary: LearningLibrary = { saved: [], recent: [], lastOpened: {} };

export function parseLibrary(raw: string | null): LearningLibrary {
  if (!raw) {
    return { ...emptyLibrary };
  }
  const value = JSON.parse(raw);
  if (
    !value ||
    !Array.isArray(value.saved) ||
    !value.saved.every((id: unknown) => typeof id === 'string') ||
    !Array.isArray(value.recent) ||
    !value.recent.every((id: unknown) => typeof id === 'string') ||
    !value.lastOpened ||
    typeof value.lastOpened !== 'object' ||
    Array.isArray(value.lastOpened) ||
    !Object.values(value.lastOpened).every(
      resource => typeof resource === 'string',
    )
  ) {
    throw new Error('Invalid learning library');
  }
  return {
    saved: [...new Set<string>(value.saved)],
    recent: [...new Set<string>(value.recent)].slice(0, 8),
    lastOpened: value.lastOpened,
  };
}

export function useLearningLibrary(userId?: string) {
  const key = `studentai:library:v1:${userId ?? 'guest'}`;
  const [stored, setStored] = useState<{
    key: string;
    library: LearningLibrary;
  } | null>(null);
  const [storageError, setStorageError] = useState(false);
  const ready = stored?.key === key;
  const library = ready ? stored.library : emptyLibrary;

  useEffect(() => {
    let active = true;
    setStorageError(false);
    AsyncStorage.getItem(key)
      .then(raw => {
        if (active) {
          setStored({ key, library: parseLibrary(raw) });
        }
      })
      .catch(() => {
        if (active) {
          setStorageError(true);
          setStored({ key, library: { ...emptyLibrary } });
        }
      });
    return () => {
      active = false;
    };
  }, [key]);

  useEffect(() => {
    if (stored?.key !== key) {
      return;
    }
    let active = true;
    AsyncStorage.setItem(key, JSON.stringify(stored.library)).catch(() => {
      if (active) {
        setStorageError(true);
      }
    });
    return () => {
      active = false;
    };
  }, [key, stored]);

  const update = (
    transform: (previous: LearningLibrary) => LearningLibrary,
  ) => {
    setStored(previous =>
      previous?.key === key
        ? { key, library: transform(previous.library) }
        : previous,
    );
  };

  return {
    library,
    ready,
    storageError,
    toggleSaved: (id: string) =>
      update(previous => ({
        ...previous,
        saved: previous.saved.includes(id)
          ? previous.saved.filter(saved => saved !== id)
          : [...previous.saved, id],
      })),
    recordView: (id: string) =>
      update(previous => ({
        ...previous,
        recent: [id, ...previous.recent.filter(recent => recent !== id)].slice(
          0,
          8,
        ),
      })),
    recordResource: (id: string, resource: string) =>
      update(previous => ({
        ...previous,
        lastOpened: { ...previous.lastOpened, [id]: resource },
      })),
  };
}
