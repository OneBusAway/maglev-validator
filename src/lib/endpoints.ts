export const endpoints = [
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
				placeholder: 'Timestamp'
			},
			{
				name: 'key',
				label: 'API Key',
				required: true,
				inPath: false,
				default: 'test',
				placeholder: 'API Key'
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
			}
		]
	}
];
