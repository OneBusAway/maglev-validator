export const endpoints = [
	{
		id: 'trip',
		name: 'Trip',
		path: 'trip/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Trip ID',
				required: true,
				inPath: true,
				default: '',
				placeholder: 'e.g., 1_605425455'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'trip-details',
		name: 'Trip Details',
		path: 'trip-details/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Trip ID',
				required: true,
				inPath: true,
				default: 'unitrans_A_13_outbound_2140',
				placeholder: 'e.g., unitrans_A_13_outbound_2140'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'serviceDate',
				label: 'Service Date',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Unix time in ms (optional)'
			},
			{
				name: 'includeTrip',
				label: 'Include Trip',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'true/false (optional)'
			},
			{
				name: 'includeSchedule',
				label: 'Include Schedule',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'true/false (optional)'
			},
			{
				name: 'includeStatus',
				label: 'Include Status',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'true/false (optional)'
			},
			{
				name: 'time',
				label: 'Time',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Unix timestamp (optional)'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'stops-for-route',
		name: 'Stops for Route',
		path: 'stops-for-route/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Route ID',
				required: true,
				inPath: true,
				default: '',
				placeholder: 'e.g., unitrans_A'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includePolylines',
				label: 'Include Polylines',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'true/false (optional)'
			},
			{
				name: 'time',
				label: 'Time',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'YYYY-MM-DD or Unix timestamp (optional)'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'arrivals-and-departures-for-stop',
		name: 'Arrivals and Departures for Stop',
		path: 'arrivals-and-departures-for-stop/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Stop ID',
				required: true,
				inPath: true,
				default: '',
				placeholder: 'e.g., unitrans_22203'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'minutesBefore',
				label: 'Minutes Before',
				required: false,
				inPath: false,
				default: '5',
				placeholder: 'Include vehicles arrived in previous n minutes (optional)'
			},
			{
				name: 'minutesAfter',
				label: 'Minutes After',
				required: false,
				inPath: false,
				default: '35',
				placeholder: 'Include vehicles arriving in next n minutes (optional)'
			},
			{
				name: 'time',
				label: 'Time',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Unix timestamp (optional)'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'arrivals-and-departures-for-location',
		name: 'Arrivals and Departures for Location',
		path: 'arrivals-and-departures-for-location.json',
		params: [
			{
				name: 'lat',
				label: 'Latitude',
				required: true,
				inPath: false,
				default: '',
				placeholder: 'e.g., 38.5382'
			},
			{
				name: 'lon',
				label: 'Longitude',
				required: true,
				inPath: false,
				default: '',
				placeholder: 'e.g., -121.7617'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'radius',
				label: 'Radius',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Search radius in meters (default: 10000)'
			},
			{
				name: 'latSpan',
				label: 'Latitude Span',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'e.g., 0.01 (alternative to radius)'
			},
			{
				name: 'lonSpan',
				label: 'Longitude Span',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'e.g., 0.01 (alternative to radius)'
			},
			{
				name: 'time',
				label: 'Time',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Unix timestamp (optional)'
			},
			{
				name: 'minutesBefore',
				label: 'Minutes Before',
				required: false,
				inPath: false,
				default: '5',
				placeholder: 'Include vehicles arrived in previous n minutes (default: 5, max: 60)'
			},
			{
				name: 'minutesAfter',
				label: 'Minutes After',
				required: false,
				inPath: false,
				default: '35',
				placeholder: 'Include vehicles arriving in next n minutes (default: 35, max: 240)'
			},
			{
				name: 'frequencyMinutesBefore',
				label: 'Frequency Minutes Before',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Defaults to minutesBefore value'
			},
			{
				name: 'frequencyMinutesAfter',
				label: 'Frequency Minutes After',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Defaults to minutesAfter value'
			},
			{
				name: 'maxCount',
				label: 'Max Count',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Maximum arrivals/departures to return (default: 250)'
			},
			{
				name: 'emptyReturnsNotFound',
				label: 'Empty Returns Not Found',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Return 404 when no stops found (default: false)'
			},
			{
				name: 'routeType',
				label: 'Route Type',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Comma-delimited route types (e.g., 0,3)'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'stop',
		name: 'Stop',
		path: 'stop/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Stop ID',
				required: true,
				inPath: true,
				default: '',
				placeholder: 'e.g., unitrans_22203'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'route',
		name: 'Route',
		path: 'route/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Route ID',
				required: true,
				inPath: true,
				default: '',
				placeholder: 'e.g., unitrans_A'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'routes-for-agency',
		name: 'Routes for Agency',
		path: 'routes-for-agency/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Agency ID',
				required: true,
				inPath: true,
				default: '',
				placeholder: 'e.g., unitrans'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'agencies-with-coverage',
		name: 'Agencies with Coverage',
		path: 'agencies-with-coverage.json',
		params: [
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'current-time',
		name: 'Current Time',
		path: 'current-time.json',
		params: [
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'trip-for-vehicle',
		name: 'Trip for Vehicle',
		path: 'trip-for-vehicle/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Vehicle ID',
				required: true,
				inPath: true,
				default: '',
				placeholder: 'e.g., vehicle_123'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeTrip',
				label: 'Include Trip',
				required: false,
				inPath: false,
				default: 'false',
				placeholder: 'true/false (optional)'
			},
			{
				name: 'includeSchedule',
				label: 'Include Schedule',
				required: false,
				inPath: false,
				default: 'false',
				placeholder: 'true/false (optional)'
			},
			{
				name: 'includeStatus',
				label: 'Include Status',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'true/false (optional)'
			},
			{
				name: 'time',
				label: 'Time',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Unix timestamp (optional)'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'trips-for-route',
		name: 'Trips for Route',
		path: 'trips-for-route/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Route ID',
				required: true,
				inPath: true,
				default: '',
				placeholder: 'e.g., unitrans_A'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'stops-for-location',
		name: 'Stops for Location',
		path: 'stops-for-location.json',
		params: [
			{
				name: 'lat',
				label: 'Latitude',
				required: true,
				inPath: false,
				default: '',
				placeholder: 'e.g., 38.5382'
			},
			{
				name: 'lon',
				label: 'Longitude',
				required: true,
				inPath: false,
				default: '',
				placeholder: 'e.g., -121.7617'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'radius',
				label: 'Radius',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Search radius in meters (optional)'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'routes-for-location',
		name: 'Routes for Location',
		path: 'routes-for-location.json',
		params: [
			{
				name: 'lat',
				label: 'Latitude',
				required: true,
				inPath: false,
				default: '',
				placeholder: 'e.g., 38.5382'
			},
			{
				name: 'lon',
				label: 'Longitude',
				required: true,
				inPath: false,
				default: '',
				placeholder: 'e.g., -121.7617'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'radius',
				label: 'Radius',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Search radius in meters (optional)'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'agency',
		name: 'Agency',
		path: 'agency/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Agency ID',
				required: true,
				inPath: true,
				default: '1',
				placeholder: 'e.g., 1'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'arrival-and-departure-for-stop',
		name: 'Arrival & Departure for Stop',
		path: 'arrival-and-departure-for-stop/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Stop ID',
				required: true,
				inPath: true,
				default: '',
				placeholder: 'e.g., unitrans_22203'
			},
			{
				name: 'tripId',
				label: 'Trip ID',
				required: true,
				inPath: false,
				default: '',
				placeholder: 'e.g., unitrans_A_13_outbound'
			},
			{
				name: 'serviceDate',
				label: 'Service Date',
				required: true,
				inPath: false,
				default: '',
				placeholder: 'Unix timestamp in ms'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'vehicleId',
				label: 'Vehicle ID',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Vehicle id (optional)'
			},
			{
				name: 'stopSequence',
				label: 'Stop Sequence',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Stop sequence index (optional)'
			},
			{
				name: 'time',
				label: 'Time',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'Unix timestamp (optional)'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'block',
		name: 'Block',
		path: 'block/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Block ID',
				required: true,
				inPath: true,
				default: '',
				placeholder: 'e.g., unitrans_111'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'config',
		name: 'Config',
		path: 'config.json',
		params: [
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'report-problem-with-stop',
		name: 'Report Problem with Stop',
		path: 'report-problem-with-stop.json',
		params: [
			{
				name: 'stopId',
				label: 'Stop ID',
				required: true,
				inPath: false,
				default: '',
				placeholder: 'e.g., unitrans_22203'
			},
			{
				name: 'code',
				label: 'Code',
				required: false,
				inPath: false,
				default: 'stop_location_wrong',
				placeholder: 'problem code'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'report-problem-with-trip',
		name: 'Report Problem with Trip',
		path: 'report-problem-with-trip.json',
		params: [
			{
				name: 'tripId',
				label: 'Trip ID',
				required: true,
				inPath: false,
				default: '',
				placeholder: 'e.g., unitrans_A_13'
			},
			{
				name: 'code',
				label: 'Code',
				required: false,
				inPath: false,
				default: 'vehicle_never_came',
				placeholder: 'problem code'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'route-ids-for-agency',
		name: 'Route IDs for Agency',
		path: 'route-ids-for-agency/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Agency ID',
				required: true,
				inPath: true,
				default: 'unitrans',
				placeholder: 'e.g., unitrans'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'schedule-for-route',
		name: 'Schedule for Route',
		path: 'schedule-for-route/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Route ID',
				required: true,
				inPath: true,
				default: '',
				placeholder: 'e.g., unitrans_A'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'date',
				label: 'Date',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'YYYY-MM-DD (optional)'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'schedule-for-stop',
		name: 'Schedule for Stop',
		path: 'schedule-for-stop/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Stop ID',
				required: true,
				inPath: true,
				default: '',
				placeholder: 'e.g., unitrans_22203'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'date',
				label: 'Date',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'YYYY-MM-DD (optional)'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'shape',
		name: 'Shape',
		path: 'shape/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Shape ID',
				required: true,
				inPath: true,
				default: '',
				placeholder: 'e.g., shape_1'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'stop-ids-for-agency',
		name: 'Stop IDs for Agency',
		path: 'stop-ids-for-agency/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Agency ID',
				required: true,
				inPath: true,
				default: 'unitrans',
				placeholder: 'e.g., unitrans'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'stops-for-agency',
		name: 'Stops for Agency',
		path: 'stops-for-agency/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Agency ID',
				required: true,
				inPath: true,
				default: 'unitrans',
				placeholder: 'e.g., unitrans'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'trips-for-location',
		name: 'Trips for Location',
		path: 'trips-for-location.json',
		params: [
			{
				name: 'lat',
				label: 'Latitude',
				required: true,
				inPath: false,
				default: '',
				placeholder: 'e.g., 38.5382'
			},
			{
				name: 'lon',
				label: 'Longitude',
				required: true,
				inPath: false,
				default: '',
				placeholder: 'e.g., -121.7617'
			},
			{
				name: 'latSpan',
				label: 'Latitude Span',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'e.g., 0.01'
			},
			{
				name: 'lonSpan',
				label: 'Longitude Span',
				required: false,
				inPath: false,
				default: '',
				placeholder: 'e.g., 0.01'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	},
	{
		id: 'vehicles-for-agency',
		name: 'Vehicles for Agency',
		path: 'vehicles-for-agency/{id}.json',
		params: [
			{
				name: 'id',
				label: 'Agency ID',
				required: true,
				inPath: true,
				default: 'unitrans',
				placeholder: 'e.g., unitrans'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
			},
			{
				name: 'includeReferences',
				label: 'Include References',
				required: false,
				inPath: false,
				default: 'true',
				placeholder: 'Include referenced entities (default: true)'
			}
		]
	}
];
