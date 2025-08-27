import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { healthAPI, credentialsAPI } from '../services/api';

// Initial state
const initialState = {
  // App status
  loading: false,
  error: null,
  
  // Health status
  serverHealth: null,
  
  // Credentials status
  credentials: {},
  
  // Bids data
  bids: [],
  bidsPagination: {
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false,
  },
  
  // UI state
  sidebarOpen: false,
  lastFetchTime: null,
};

// Action types
export const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_SERVER_HEALTH: 'SET_SERVER_HEALTH',
  SET_CREDENTIALS: 'SET_CREDENTIALS',
  SET_BIDS: 'SET_BIDS',
  SET_BIDS_PAGINATION: 'SET_BIDS_PAGINATION',
  TOGGLE_SIDEBAR: 'TOGGLE_SIDEBAR',
  SET_LAST_FETCH_TIME: 'SET_LAST_FETCH_TIME',
};

// Reducer function
const appReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    
    case ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    
    case ACTIONS.SET_SERVER_HEALTH:
      return { ...state, serverHealth: action.payload };
    
    case ACTIONS.SET_CREDENTIALS:
      return { ...state, credentials: action.payload };
    
    case ACTIONS.SET_BIDS:
      return { ...state, bids: action.payload };
    
    case ACTIONS.SET_BIDS_PAGINATION:
      return { ...state, bidsPagination: action.payload };
    
    case ACTIONS.TOGGLE_SIDEBAR:
      return { ...state, sidebarOpen: !state.sidebarOpen };
    
    case ACTIONS.SET_LAST_FETCH_TIME:
      return { ...state, lastFetchTime: action.payload };
    
    default:
      return state;
  }
};

// Create context
const AppContext = createContext();

// Context provider component
export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Helper function to handle async operations
  const handleAsync = async (asyncFn, errorMessage = 'An error occurred') => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: ACTIONS.CLEAR_ERROR });
      return await asyncFn();
    } catch (error) {
      console.error(errorMessage, error);
      dispatch({ 
        type: ACTIONS.SET_ERROR, 
        payload: error.message || errorMessage 
      });
      throw error;
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Actions
  const actions = {
    // Set loading state
    setLoading: (loading) => {
      dispatch({ type: ACTIONS.SET_LOADING, payload: loading });
    },

    // Set error
    setError: (error) => {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error });
    },

    // Clear error
    clearError: () => {
      dispatch({ type: ACTIONS.CLEAR_ERROR });
    },

    // Check server health
    checkHealth: async () => {
      return handleAsync(async () => {
        const response = await healthAPI.getHealth();
        dispatch({ type: ACTIONS.SET_SERVER_HEALTH, payload: response.data });
        return response.data;
      }, 'Failed to check server health');
    },

    // Load credentials status
    loadCredentials: async () => {
      return handleAsync(async () => {
        const response = await credentialsAPI.getCredentials();
        dispatch({ type: ACTIONS.SET_CREDENTIALS, payload: response.data.data });
        return response.data.data;
      }, 'Failed to load credentials');
    },

    // Set bids and pagination
    setBids: (bids, pagination) => {
      dispatch({ type: ACTIONS.SET_BIDS, payload: bids });
      if (pagination) {
        dispatch({ type: ACTIONS.SET_BIDS_PAGINATION, payload: pagination });
      }
    },

    // Toggle sidebar
    toggleSidebar: () => {
      dispatch({ type: ACTIONS.TOGGLE_SIDEBAR });
    },

    // Set last fetch time
    setLastFetchTime: (time) => {
      dispatch({ type: ACTIONS.SET_LAST_FETCH_TIME, payload: time });
    },
  };

  // Initialize app data on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await actions.checkHealth();
        await actions.loadCredentials();
      } catch (error) {
        console.warn('Failed to initialize app data:', error);
      }
    };

    initializeApp();
  }, []);

  const value = {
    state,
    actions,
    dispatch,
    handleAsync,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Custom hook to use the app context
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;